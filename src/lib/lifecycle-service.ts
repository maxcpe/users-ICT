// ปิด/เปิดใช้งาน ลบแถวที่เพิ่มผิด ล้างสิทธิ์ทั้งระบบ (spec 4.5, 4.5.1, 4.6.1)
// ผู้ดูแลกลางเท่านั้น ทุกอย่างบันทึก + audit ใน transaction เดียว

import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { writeAudit } from "./audit";
import { prisma, type Tx } from "./db";
import { bangkokToday, checkDeactivate, deleteBlockers, isScheduled } from "./lifecycle-rules";
import {
  clearSystemRoles,
  countMultiHolders,
  countTableRoles,
  deleteStaffRow,
  getStaffByIds,
  listHolders,
  moveColumnToRoles,
  nonNullRoleColumns,
  readRoleForUpdate,
  readRoleSetForUpdate,
  readStaffForUpdate,
  ReadOnlyUserDbError,
  renameRolesKey,
  writeRole,
  writeRoleSet,
} from "./registry";
import { syncUsersLevel, usersSystem } from "./role-service";
import { CENTRAL_LEVEL, isCentral, type Actor } from "./roles";
import { listSystems } from "./system-repo";
import { isValidSystemKey, USERS_SYSTEM_KEY } from "./systems";
import { normalizeEmail } from "./text";

export type Result = { ok: true; message: string } | { ok: false; error: string };

class StopError extends Error {}

async function guarded(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof StopError || e instanceof ReadOnlyUserDbError) return { ok: false, error: e.message };
    throw e;
  }
}

/** ผู้ดูแลกลางที่ยังใช้งานอยู่ ไม่นับ excludeId */
async function otherActiveCentrals(tx: Tx, excludeId: number): Promise<number> {
  const users = await usersSystem();
  const holders = (await listHolders(users, tx)).filter((h) => h.level === CENTRAL_LEVEL && h.id !== excludeId);
  if (!holders.length) return 0;
  const inactive = await tx.userStatus.count({ where: { userId: { in: holders.map((h) => h.id) }, status: "inactive" } });
  return holders.length - inactive;
}

/** ขั้นตอนปิดใช้งานจริง: เก็บสิทธิ์เดิม ล้างทุกระบบ ถอนผู้ดูแล (spec 4.5 ข้อ 2–4) */
async function applyDeactivation(tx: Tx, actorId: number, userId: number, reason: string, effectiveDate: string) {
  const systems = await listSystems({ includeInactive: true });
  // ระบบปกติเก็บเป็นตัวเลข ระบบหลายสิทธิ์เก็บเป็น array ของทุกบทบาท (spec 2.3)
  const saved: Record<string, number | number[]> = {};
  for (const s of systems) {
    if (s.multi) {
      const set = await readRoleSetForUpdate(tx, s, userId);
      if (!set.length) continue;
      saved[s.key] = set;
      await writeRoleSet(tx, s, userId, []);
      continue;
    }
    const v = await readRoleForUpdate(tx, s, userId);
    if (v === null) continue;
    saved[s.key] = v;
    if (s.key !== USERS_SYSTEM_KEY) await writeRole(tx, s, userId, null);
  }
  const admins = await tx.systemAdmin.findMany({ where: { userId }, select: { systemKey: true } });
  await tx.systemAdmin.deleteMany({ where: { userId } });
  // คนที่ปิดใช้งานเข้าระบบนี้ไม่ได้อยู่แล้ว (access.ts) ล้างบทบาทใน users ด้วยเพื่อไม่ให้ค้าง
  if (saved[USERS_SYSTEM_KEY] !== undefined) await writeRole(tx, await usersSystem(), userId, null);

  const savedRoles = { ...saved, _admins: admins.map((a) => a.systemKey) };
  await tx.userStatus.upsert({
    where: { userId },
    create: { userId, status: "inactive", reason, effectiveDate: new Date(effectiveDate), savedRoles, changedBy: actorId },
    update: { status: "inactive", reason, effectiveDate: new Date(effectiveDate), savedRoles, changedBy: actorId, changedAt: new Date() },
  });
  await writeAudit(tx, { actorId, action: "user.deactivate", targetId: userId, changes: { reason, effectiveDate, roles: savedRoles } });
}

export async function deactivate(actor: Actor, userId: number, reason: string, effectiveDate: string): Promise<Result> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  const today = bangkokToday();
  return guarded(() =>
    prisma.$transaction(async (tx) => {
      const [staff] = await getStaffByIds([userId], tx);
      if (!staff) throw new StopError("ไม่พบบุคลากรคนนี้");
      const status = await tx.userStatus.findUnique({ where: { userId } });
      const usersLevel = await readRoleForUpdate(tx, await usersSystem(), userId);
      const err = checkDeactivate({
        actorId: actor.userId,
        targetId: userId,
        alreadyInactive: status?.status === "inactive",
        targetIsCentral: usersLevel === CENTRAL_LEVEL,
        otherActiveCentrals: await otherActiveCentrals(tx, userId),
        effectiveDate,
        today,
      });
      if (err) throw new StopError(err);

      if (isScheduled(effectiveDate, today)) {
        const data = { status: "scheduled" as const, reason, effectiveDate: new Date(effectiveDate), savedRoles: {}, changedBy: actor.userId };
        await tx.userStatus.upsert({ where: { userId }, create: { userId, ...data }, update: { ...data, changedAt: new Date() } });
        await writeAudit(tx, { actorId: actor.userId, action: "user.deactivate", targetId: userId, changes: { reason, effectiveDate, scheduled: true } });
        return { ok: true as const, message: `ตั้งปิดใช้งานวันที่ ${effectiveDate} แล้ว สิทธิ์ยังใช้ได้จนถึงวันนั้น` };
      }
      await applyDeactivation(tx, actor.userId, userId, reason, effectiveDate);
      return { ok: true as const, message: "ปิดใช้งานแล้ว สิทธิ์เดิมถูกเก็บไว้ให้คืนได้" };
    }),
  );
}

/** งานตั้งเวลา: ปิดใช้งานคนที่ถึงวันแล้ว (spec 4.5 ปิดใช้งานล่วงหน้า) */
export async function applyDueDeactivations(): Promise<number> {
  const due = await prisma.userStatus.findMany({ where: { status: "scheduled", effectiveDate: { lte: new Date(bangkokToday()) } } });
  let done = 0;
  for (const s of due) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.userStatus.findUnique({ where: { userId: s.userId } });
      if (fresh?.status !== "scheduled") return;
      await applyDeactivation(tx, s.changedBy, s.userId, s.reason, bangkokToday());
      done++;
    });
  }
  return done;
}

/** เปิดใช้งานอีกครั้ง คืนสิทธิ์เฉพาะระบบที่เลือก หรือยกเลิกการปิดล่วงหน้า */
export async function reactivate(actor: Actor, userId: number, restoreKeys: string[]): Promise<Result> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  return guarded(() =>
    prisma.$transaction(async (tx) => {
      const status = await tx.userStatus.findUnique({ where: { userId } });
      if (!status || status.status === "active") throw new StopError("คนนี้ใช้งานอยู่แล้ว");

      if (status.status === "scheduled") {
        await tx.userStatus.update({ where: { userId }, data: { status: "active", savedRoles: {}, changedBy: actor.userId, changedAt: new Date() } });
        await writeAudit(tx, { actorId: actor.userId, action: "user.reactivate", targetId: userId, changes: { cancelScheduled: status.effectiveDate.toISOString().slice(0, 10) } });
        return { ok: true as const, message: "ยกเลิกการปิดใช้งานล่วงหน้าแล้ว" };
      }

      const saved = (status.savedRoles ?? {}) as Record<string, unknown>;
      const systems = new Map((await listSystems({ includeInactive: true })).map((s) => [s.key, s]));
      const restored: Record<string, number | number[]> = {};
      for (const key of restoreKeys) {
        const value = saved[key];
        const system = systems.get(key);
        // บทบาทในระบบนี้ (users) และผู้ดูแล ไม่คืนอัตโนมัติ ต้องแต่งตั้งใหม่ (spec 4.6)
        if (key === USERS_SYSTEM_KEY || key === "_admins" || !system) continue;
        const levels = Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : typeof value === "number" ? [value] : [];
        if (!levels.length) continue;
        if (system.multi) {
          // ระบบเปลี่ยนเป็นหลายสิทธิ์ระหว่างปิดใช้งานก็คืนได้ (ค่าเดียวกลายเป็นบทบาทเดียว)
          if ((await readRoleSetForUpdate(tx, system, userId)).length) continue; // มีค่าใหม่แล้ว ไม่ทับ
          await writeRoleSet(tx, system, userId, levels);
          restored[key] = levels;
          continue;
        }
        if ((await readRoleForUpdate(tx, system, userId)) !== null) continue; // มีค่าใหม่แล้ว ไม่ทับ
        const single = Math.max(...levels); // ระบบปิดหลายสิทธิ์ระหว่างนั้น: คืนระดับสูงสุด
        await writeRole(tx, system, userId, single);
        restored[key] = single;
      }
      await tx.userStatus.update({ where: { userId }, data: { status: "active", savedRoles: {}, changedBy: actor.userId, changedAt: new Date() } });
      await writeAudit(tx, { actorId: actor.userId, action: "user.reactivate", targetId: userId, changes: { restored } });
      const n = Object.keys(restored).length;
      return { ok: true as const, message: n ? `เปิดใช้งานแล้ว คืนสิทธิ์ ${n} ระบบ` : "เปิดใช้งานแล้ว ยังไม่มีสิทธิ์ในระบบใด" };
    }),
  );
}

/** ข้อเท็จจริงสำหรับตัดสินว่าลบได้ไหม (ใช้ทั้งแสดงปุ่มและตรวจซ้ำตอนลบ) */
export async function deleteFacts(db: Tx | typeof prisma, userId: number) {
  const [created, cols, tableRoles, adminCount, identity] = await Promise.all([
    db.auditLog.findFirst({ where: { action: "user.create", targetId: userId }, orderBy: { at: "asc" } }),
    nonNullRoleColumns(db, userId),
    countTableRoles(db, userId),
    db.systemAdmin.count({ where: { userId } }),
    db.userIdentity.findUnique({ where: { userId } }),
  ]);
  return { createdAt: created?.at ?? null, now: new Date(), nonNullRoleColumns: cols, tableRoleCount: tableRoles, adminCount, hasIdentity: !!identity };
}

/** ลบแถวที่เพิ่มผิด (spec 4.5.1) — ต้องพิมพ์อีเมลของแถวนั้นยืนยัน (ไม่มีอีเมลให้พิมพ์รหัส) */
export async function deleteStaff(actor: Actor, userId: number, confirmation: string): Promise<Result> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  if (actor.userId === userId) return { ok: false, error: "ลบตัวเองไม่ได้" };
  return guarded(() =>
    prisma.$transaction(async (tx) => {
      const row = await readStaffForUpdate(tx, userId);
      if (!row) throw new StopError("ไม่พบบุคลากรคนนี้");
      const expected = row.U_email?.trim() ? normalizeEmail(row.U_email) : String(userId);
      if (normalizeEmail(confirmation) !== expected) throw new StopError("ข้อความยืนยันไม่ตรง");

      const blockers = deleteBlockers(await deleteFacts(tx, userId));
      if (blockers.length) throw new StopError(`ลบไม่ได้: ${blockers.join(" · ")}`);

      const n = await deleteStaffRow(tx, userId);
      if (n !== 1) throw new StopError("ลบไม่สำเร็จ ข้อมูลเปลี่ยนระหว่างลบ ไม่มีอะไรถูกลบ");
      await tx.userStatus.deleteMany({ where: { userId } });
      // สำเนาข้อมูลทั่วไปทั้งแถว ไม่รวมข้อมูลอ่อนไหว
      await writeAudit(tx, {
        actorId: actor.userId,
        action: "user.delete",
        targetId: userId,
        changes: { name: row.U_name, email: row.U_email, position: row.U_position, branch: row.U_branch, job: row.U_job },
      });
      return { ok: true as const, message: "ลบแล้ว" };
    }),
  );
}

/** ล้างสิทธิ์ทั้งระบบ (spec 4.6.1) — ต้องพิมพ์ key ของระบบยืนยัน */
export async function clearSystem(actor: Actor, key: string, confirmation: string): Promise<Result> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  if (key === USERS_SYSTEM_KEY) return { ok: false, error: "ใช้กับระบบนี้ไม่ได้" };
  if (confirmation.trim() !== key) return { ok: false, error: "key ที่พิมพ์ไม่ตรง" };
  const system = (await listSystems({ includeInactive: true })).find((s) => s.key === key);
  if (!system) return { ok: false, error: "ไม่พบระบบนี้" };
  return guarded(() =>
    prisma.$transaction(
      async (tx) => {
        const holders = await listHolders(system, tx);
        const before = Object.fromEntries(holders.map((h) => [h.id, system.multi ? h.levels : h.level]));
        await clearSystemRoles(tx, system);
        const cleared = holders.length;
        const admins = await tx.systemAdmin.findMany({ where: { systemKey: key }, select: { userId: true } });
        await tx.systemAdmin.deleteMany({ where: { systemKey: key } });
        for (const a of admins) await syncUsersLevel(tx, actor, a.userId);
        await writeAudit(tx, {
          actorId: actor.userId,
          action: "system.clear",
          systemKey: key,
          changes: { before, admins: admins.map((a) => a.userId) } as Prisma.InputJsonValue,
        });
        return { ok: true as const, message: `ล้างสิทธิ์ ${cleared} คน และถอนผู้ดูแล ${admins.length} คนแล้ว` };
      },
      { timeout: 30_000 },
    ),
  );
}

/**
 * เปลี่ยน key ของระบบ: สร้างแถวใหม่ ย้ายผู้ดูแลและสิทธิ์ใน user_roles แล้วลบแถวเดิม ใน transaction เดียว
 * audit log เดิมคงเป็น key เดิม (แก้ย้อนหลังไม่ได้) และบันทึก system.rename ไว้เชื่อมกัน
 * เว็บที่อ่าน v_roles ด้วย key เดิมต้องแก้โค้ดตาม — หน้าจอต้องเตือนก่อนยืนยัน
 */
export async function renameSystemKey(actor: Actor, oldKey: string, newKeyRaw: string): Promise<Result & { key?: string }> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  const newKey = newKeyRaw.trim();
  if (oldKey === USERS_SYSTEM_KEY) return { ok: false, error: "เปลี่ยน key ของระบบนี้ไม่ได้" };
  if (newKey === oldKey) return { ok: false, error: "key ใหม่เหมือน key เดิม" };
  if (!isValidSystemKey(newKey)) return { ok: false, error: "key ใช้ได้เฉพาะ a–z ตัวเลข และ _ ขึ้นต้นด้วยตัวอักษร ยาว 2–50 ตัว (ใช้ users ไม่ได้)" };
  return guarded(() =>
    prisma.$transaction(async (tx) => {
      const old = await tx.system.findUnique({ where: { key: oldKey } });
      if (!old) throw new StopError("ไม่พบระบบนี้");
      if (await tx.system.findUnique({ where: { key: newKey } })) throw new StopError(`มีระบบที่ใช้ key "${newKey}" อยู่แล้ว`);

      // column_name เป็น unique ต้องปล่อยจากแถวเดิมก่อนสร้างแถวใหม่
      await tx.system.update({ where: { key: oldKey }, data: { columnName: null } });
      await tx.system.create({
        data: {
          key: newKey,
          storage: old.storage,
          columnName: old.columnName,
          name: old.name,
          icon: old.icon,
          url: old.url,
          note: old.note,
          levels: old.levels as Prisma.InputJsonValue,
          unconfirmed: old.unconfirmed,
          active: old.active,
          sortOrder: old.sortOrder,
          multi: old.multi,
        },
      });
      const admins = await tx.systemAdmin.updateMany({ where: { systemKey: oldKey }, data: { systemKey: newKey } });
      const roles = await renameRolesKey(tx, oldKey, newKey);
      await tx.system.delete({ where: { key: oldKey } });
      await writeAudit(tx, {
        actorId: actor.userId,
        action: "system.rename",
        systemKey: newKey,
        changes: { key: [oldKey, newKey], admins: admins.count, roles },
      });
      return { ok: true as const, message: `เปลี่ยน key เป็น ${newKey} แล้ว`, key: newKey };
    }),
  ) as Promise<Result & { key?: string }>;
}

/**
 * เปิด/ปิด "หลายสิทธิ์ต่อคน" (spec 2.3) — ผู้ดูแลกลาง ต้องพิมพ์ key ยืนยัน
 * เปิด: ระบบแบบ column ย้ายค่าทั้งหมดไป user_roles แล้วตั้งคอลัมน์เดิมเป็น NULL (ไม่เขียนคอลัมน์เดิมอีก)
 * ปิด: ได้เฉพาะเมื่อไม่มีใครถือมากกว่า 1 บทบาท และคงเก็บใน user_roles
 */
export async function setMultiRoles(actor: Actor, key: string, enable: boolean, confirmation: string): Promise<Result> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  if (key === USERS_SYSTEM_KEY) return { ok: false, error: "ระบบนี้เป็นแบบระดับเดียวเสมอ" };
  if (confirmation.trim() !== key) return { ok: false, error: "key ที่พิมพ์ไม่ตรง" };
  const system = (await listSystems({ includeInactive: true })).find((s) => s.key === key);
  if (!system) return { ok: false, error: "ไม่พบระบบนี้" };
  if (system.multi === enable) return { ok: true, message: enable ? "เปิดอยู่แล้ว" : "ปิดอยู่แล้ว" };

  return guarded(() =>
    prisma.$transaction(
      async (tx) => {
        if (!enable) {
          const multiHolders = await countMultiHolders(system, tx);
          if (multiHolders > 0) throw new StopError(`ปิดไม่ได้: มี ${multiHolders} คนถือมากกว่า 1 บทบาท ถอนให้เหลือคนละบทบาทก่อน`);
          await tx.system.update({ where: { key }, data: { multi: false } });
          await writeAudit(tx, { actorId: actor.userId, action: "system.multi", systemKey: key, changes: { multi: false } });
          return { ok: true as const, message: "ปิดหลายสิทธิ์ต่อคนแล้ว (ยังเก็บในตารางกลาง)" };
        }
        const fromColumn = system.storage === "column" ? system.columnName : null;
        const moved = await moveColumnToRoles(tx, system);
        await tx.system.update({ where: { key }, data: { multi: true, storage: "table" } });
        await writeAudit(tx, {
          actorId: actor.userId,
          action: "system.multi",
          systemKey: key,
          changes: { multi: true, fromColumn, moved } as Prisma.InputJsonValue,
        });
        const n = Object.keys(moved).length;
        return {
          ok: true as const,
          message: fromColumn ? `เปิดหลายสิทธิ์ต่อคนแล้ว ย้ายสิทธิ์ ${n} คนไปตารางกลาง และล้าง ${fromColumn}` : "เปิดหลายสิทธิ์ต่อคนแล้ว",
        };
      },
      { timeout: 30_000 },
    ),
  );
}

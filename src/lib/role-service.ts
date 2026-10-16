import "server-only";
// ทางเดียวที่ใช้เปลี่ยนสิทธิ์และผู้ดูแล — ตรวจทุกรายการซ้ำฝั่ง server แล้วเขียน + audit ใน transaction เดียว (spec 7)

import { writeAudit } from "./audit";
import { prisma, type Tx } from "./db";
import { getStaffByIds, readRoleForUpdate, readRoleSetForUpdate, ReadOnlyUserDbError, writeRole, writeRoleSet, type SystemDef } from "./registry";
import { checkRoleChange, normalizeLevels, ROLE_REASON_TEXT, type RoleChange } from "./role-rules";
import { CENTRAL_LEVEL, isCentral, SYSTEM_ADMIN_LEVEL, type Actor } from "./roles";
import { listSystems } from "./system-repo";
import { USERS_SYSTEM_KEY } from "./systems";

export type ApplyResult =
  | { ok: true; changed: number; unchanged: number }
  | { ok: false; error: string };

/**
 * ตั้งสิทธิ์หลายรายการแบบทั้งหมดหรือไม่มีเลย
 * ถ้ารายการใดไม่ผ่าน จะไม่บันทึกอะไรและบอกเหตุผล
 * `skipDeactivated` ใช้กับการตั้งหลายคน: ข้ามคนที่ปิดใช้งานแทนที่จะยกเลิกทั้งชุด
 */
export async function applyRoleChanges(
  actor: Actor,
  changes: RoleChange[],
  opts: { skipDeactivated?: boolean } = {},
): Promise<ApplyResult & { skipped?: number }> {
  if (changes.length === 0) return { ok: true, changed: 0, unchanged: 0 };
  if (changes.length > 500) return { ok: false, error: "เปลี่ยนได้ครั้งละไม่เกิน 500 รายการ" };

  const systems = new Map((await listSystems({ includeInactive: true })).map((s) => [s.key, s]));
  const ids = [...new Set(changes.map((c) => c.userId))];
  const inactive = new Set(
    (await prisma.userStatus.findMany({ where: { userId: { in: ids }, status: "inactive" }, select: { userId: true } })).map((s) => s.userId),
  );

  try {
    return await prisma.$transaction(async (tx) => {
      const staff = new Set((await getStaffByIds(ids, tx)).map((s) => s.id));
      let changed = 0;
      let unchanged = 0;
      let skipped = 0;
      for (const change of changes) {
        const system = systems.get(change.systemKey) ?? null;
        if (opts.skipDeactivated && inactive.has(change.userId)) {
          skipped++;
          continue;
        }
        const exists = !!system && staff.has(change.userId);
        const multi = !!system?.multi;
        const currentSet = exists && multi ? await readRoleSetForUpdate(tx, system!, change.userId) : [];
        const current = exists && !multi ? await readRoleForUpdate(tx, system!, change.userId) : null;
        const check = checkRoleChange({
          actor,
          change,
          system,
          targetExists: staff.has(change.userId),
          targetInactive: inactive.has(change.userId),
          current,
          currentSet,
        });
        if (!check.ok) throw new RoleError(`U_id ${change.userId}: ${ROLE_REASON_TEXT[check.reason]}`);
        if (check.kind === "same") {
          unchanged++;
          continue;
        }
        if (multi) {
          const next = normalizeLevels(change.levels!);
          await writeRoleSet(tx, system!, change.userId, next);
          await writeAudit(tx, {
            actorId: actor.userId,
            action: "role.set",
            targetId: change.userId,
            systemKey: change.systemKey,
            changes: { levels: [currentSet, next] },
          });
          changed++;
          continue;
        }
        await writeRole(tx, system!, change.userId, change.value);
        await writeAudit(tx, {
          actorId: actor.userId,
          action: "role.set",
          targetId: change.userId,
          systemKey: change.systemKey,
          changes: { level: [current, change.value] },
        });
        changed++;
      }
      return { ok: true as const, changed, unchanged, skipped };
    });
  } catch (e) {
    if (e instanceof RoleError || e instanceof ReadOnlyUserDbError) return { ok: false, error: e.message };
    throw e;
  }
}

class RoleError extends Error {}

// ---------- ผู้ดูแลของแต่ละระบบ (spec 4.6) ----------

export async function usersSystem(): Promise<SystemDef> {
  const s = (await listSystems({ includeInactive: true })).find((x) => x.key === USERS_SYSTEM_KEY);
  if (!s) throw new Error("ไม่พบระบบ users ในทะเบียน ต้องรัน db:seed ก่อน");
  return s;
}

/** ตั้งระดับในระบบ users ให้ตรงกับการเป็นผู้ดูแล ไม่แตะคนที่เป็นผู้ดูแลกลาง (99) */
export async function syncUsersLevel(tx: Tx, actor: Actor, userId: number): Promise<void> {
  const users = await usersSystem();
  const current = await readRoleForUpdate(tx, users, userId);
  if (current === CENTRAL_LEVEL) return;
  const stillAdmin = (await tx.systemAdmin.count({ where: { userId } })) > 0;
  const next = stillAdmin ? SYSTEM_ADMIN_LEVEL : null;
  if (current === next) return;
  await writeRole(tx, users, userId, next);
  await writeAudit(tx, { actorId: actor.userId, action: "role.set", targetId: userId, systemKey: USERS_SYSTEM_KEY, changes: { level: [current, next] } });
}

export async function assignAdmin(actor: Actor, systemKey: string, userId: number): Promise<ApplyResult> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  if (systemKey === USERS_SYSTEM_KEY) return { ok: false, error: "ระบบนี้ไม่มีผู้ดูแลแยก" };
  const system = (await listSystems({ includeInactive: true })).find((s) => s.key === systemKey);
  if (!system) return { ok: false, error: "ไม่พบระบบนี้" };
  const [staff] = await getStaffByIds([userId]);
  if (!staff) return { ok: false, error: "ไม่พบบุคลากรคนนี้" };
  const status = await prisma.userStatus.findUnique({ where: { userId } });
  if (status?.status === "inactive") return { ok: false, error: "คนนี้ถูกปิดใช้งาน แต่งตั้งเป็นผู้ดูแลไม่ได้" };

  return prisma.$transaction(async (tx) => {
    const exists = await tx.systemAdmin.findUnique({ where: { systemKey_userId: { systemKey, userId } } });
    if (exists) return { ok: true as const, changed: 0, unchanged: 1 };
    await tx.systemAdmin.create({ data: { systemKey, userId, assignedBy: actor.userId } });
    await writeAudit(tx, { actorId: actor.userId, action: "admin.assign", targetId: userId, systemKey, changes: { admin: [false, true] } });
    await syncUsersLevel(tx, actor, userId);
    return { ok: true as const, changed: 1, unchanged: 0 };
  });
}

export async function revokeAdmin(actor: Actor, systemKey: string, userId: number): Promise<ApplyResult> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  return prisma.$transaction(async (tx) => {
    const removed = await tx.systemAdmin.deleteMany({ where: { systemKey, userId } });
    if (removed.count === 0) return { ok: true as const, changed: 0, unchanged: 1 };
    await writeAudit(tx, { actorId: actor.userId, action: "admin.revoke", targetId: userId, systemKey, changes: { admin: [true, false] } });
    await syncUsersLevel(tx, actor, userId);
    return { ok: true as const, changed: 1, unchanged: 0 };
  });
}

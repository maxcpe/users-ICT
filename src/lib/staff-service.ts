import "server-only";
// เพิ่ม/แก้ข้อมูลบุคลากร (spec 4.2, 4.3) — ผู้ดูแลกลางเท่านั้น บันทึก + audit ใน transaction เดียว

import { writeAudit } from "./audit";
import { prisma } from "./db";
import { emailOwners, insertStaff, readStaffForUpdate, ReadOnlyUserDbError, updateStaff } from "./registry";
import { isCentral, type Actor } from "./roles";
import { diffStaff, STAFF_COLUMN, type StaffInput } from "./staff-rules";

export type StaffResult =
  | { ok: true; id: number }
  | { ok: false; error: string; field?: string }
  | { ok: false; confirmEmail: true; from: string | null; to: string };

function duplicateMessage(owners: { id: number; name: string | null }[]): string {
  const o = owners[0]!;
  return `อีเมลนี้ใช้อยู่แล้วกับ ${o.name ?? "—"} (รหัส ${o.id})${owners.length > 1 ? ` และอีก ${owners.length - 1} แถว` : ""} ถ้าเป็นคนเดียวกันให้แก้แถวเดิมแทน`;
}

export async function createStaff(actor: Actor, input: StaffInput): Promise<StaffResult> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  try {
    return await prisma.$transaction(async (tx) => {
      const owners = await emailOwners(input.email, tx);
      if (owners.length) return { ok: false as const, error: duplicateMessage(owners), field: "email" };
      const id = await insertStaff(tx, {
        U_name: input.name,
        U_email: input.email,
        U_position: input.position,
        U_branch: input.branch,
        U_job: input.job,
      });
      await writeAudit(tx, { actorId: actor.userId, action: "user.create", targetId: id, changes: { ...input } });
      return { ok: true as const, id };
    });
  } catch (e) {
    if (e instanceof ReadOnlyUserDbError) return { ok: false, error: e.message };
    throw e;
  }
}

/** `confirmEmail` = ผู้ใช้ยืนยันการเปลี่ยนอีเมลแล้ว (spec 4.3 ต้องยืนยันอีกครั้ง) */
export async function editStaff(actor: Actor, userId: number, input: StaffInput, confirmEmail: boolean): Promise<StaffResult> {
  if (!isCentral(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await readStaffForUpdate(tx, userId);
      if (!current) return { ok: false as const, error: "ไม่พบบุคลากรคนนี้" };
      const diff = diffStaff(
        { name: current.U_name, email: current.U_email, position: current.U_position, branch: current.U_branch, job: current.U_job },
        input,
      );
      if (Object.keys(diff).length === 0) return { ok: true as const, id: userId };

      if (diff.email) {
        if (!confirmEmail) return { ok: false as const, confirmEmail: true as const, from: diff.email[0], to: input.email };
        const owners = (await emailOwners(input.email, tx)).filter((o) => o.id !== userId);
        if (owners.length) return { ok: false as const, error: duplicateMessage(owners), field: "email" };
      }

      const changes = Object.fromEntries(Object.entries(diff).map(([k, v]) => [STAFF_COLUMN[k as keyof typeof STAFF_COLUMN], v]));
      const saved = await updateStaff(tx, userId, changes);
      if (!saved) return { ok: false as const, error: "มีคนแก้ข้อมูลนี้ก่อนแล้ว โหลดหน้าใหม่แล้วแก้อีกครั้ง" };
      await writeAudit(tx, { actorId: actor.userId, action: "user.update", targetId: userId, changes: diff });
      return { ok: true as const, id: userId };
    });
  } catch (e) {
    if (e instanceof ReadOnlyUserDbError) return { ok: false, error: e.message };
    throw e;
  }
}

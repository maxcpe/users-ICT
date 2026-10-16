"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { searchStaff, type SystemDef } from "@/lib/registry";
import { canViewSystem, isCentral } from "@/lib/roles";
import { getSystem } from "@/lib/system-repo";
import { blankToNull } from "@/lib/text";
import { applyRoleChanges, assignAdmin, revokeAdmin } from "@/lib/role-service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const id = z.number().int().positive();
const level = z.number().int().min(1).max(999).nullable();
const changeSchema = z.object({ userId: id, systemKey: z.string().max(50), value: level });

function refresh() {
  revalidatePath("/", "layout");
}

/** บันทึกการเปลี่ยนสิทธิ์จากหน้ารายคนหรือหน้าระบบ (ทั้งชุดหรือไม่บันทึกเลย) */
export async function saveRoles(input: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  const parsed = z.array(changeSchema).max(500).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง โหลดหน้าใหม่แล้วลองอีกครั้ง" };
  const r = await applyRoleChanges(actor, parsed.data);
  if (!r.ok) return r;
  refresh();
  return { ok: true, message: r.changed ? `บันทึกแล้ว ${r.changed} รายการ` : "ไม่มีอะไรเปลี่ยน" };
}

/** ตั้งสิทธิ์ระบบเดียวให้หลายคน ข้ามคนที่ปิดใช้งาน (spec 4.4) */
export async function bulkSetRole(input: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  const parsed = z.object({ systemKey: z.string().max(50), value: level, userIds: z.array(id).min(1).max(500) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง โหลดหน้าใหม่แล้วลองอีกครั้ง" };
  const { systemKey, value, userIds } = parsed.data;
  const r = await applyRoleChanges(
    actor,
    userIds.map((userId) => ({ userId, systemKey, value })),
    { skipDeactivated: true },
  );
  if (!r.ok) return r;
  refresh();
  return { ok: true, message: `เปลี่ยน ${r.changed} คน · คงเดิม ${r.unchanged} คน${r.skipped ? ` · ข้าม ${r.skipped} คน (ปิดใช้งาน)` : ""}` };
}

export async function addAdmin(systemKey: string, userId: number): Promise<ActionResult> {
  const actor = await requireActor();
  if (!id.safeParse(userId).success) return { ok: false, error: "เลือกบุคลากรก่อน" };
  const r = await assignAdmin(actor, systemKey, userId);
  if (!r.ok) return r;
  refresh();
  return { ok: true, message: r.changed ? "แต่งตั้งแล้ว" : "เป็นผู้ดูแลอยู่แล้ว" };
}

export async function removeAdmin(systemKey: string, userId: number): Promise<ActionResult> {
  const actor = await requireActor();
  const r = await revokeAdmin(actor, systemKey, userId);
  if (!r.ok) return r;
  refresh();
  return { ok: true, message: "ถอนแล้ว" };
}

export type StaffHit = { id: number; name: string; email: string | null; branch: string | null };

/**
 * ค้นหาบุคลากรสำหรับช่อง "เพิ่มคน" / "แต่งตั้งผู้ดูแล" (ไม่ส่งรายชื่อทั้งหมดไปเบราว์เซอร์)
 * systemKey: ตัดคนที่มีสิทธิ์ในระบบนั้นแล้ว และตรวจว่าผู้ค้นจัดการระบบนั้นได้
 */
export async function searchStaffAction(input: unknown): Promise<StaffHit[]> {
  const actor = await requireActor();
  const parsed = z.object({ q: z.string().max(100), systemKey: z.string().max(50).optional(), forAdmin: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return [];
  const { q, systemKey, forAdmin } = parsed.data;
  if (forAdmin && !isCentral(actor)) return [];
  let system: SystemDef | undefined;
  if (systemKey) {
    system = (await getSystem(systemKey)) ?? undefined;
    if (!system || !canViewSystem(actor, systemKey)) return [];
  }
  const [rows, inactive] = await Promise.all([
    searchStaff({ q, withoutRoleIn: forAdmin ? undefined : system, limit: 51 }),
    prisma.userStatus.findMany({ where: { status: "inactive" }, select: { userId: true } }),
  ]);
  const off = new Set(inactive.map((r) => r.userId));
  return rows
    .filter((r) => !off.has(r.id) && (forAdmin || r.id !== actor.userId))
    .slice(0, 50)
    .map((r) => ({ id: r.id, name: r.name ?? "—", email: blankToNull(r.email), branch: blankToNull(r.branch) }));
}

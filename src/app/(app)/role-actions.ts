"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { searchStaff, searchStaffIds, type StaffFilter, type StaffSearch, type SystemDef } from "@/lib/registry";
import { canViewSystem, isCentral, type Actor } from "@/lib/roles";
import { getSystem } from "@/lib/system-repo";
import { blankToNull } from "@/lib/text";
import { applyRoleChanges, assignAdmin, assignCentral, revokeAdmin, revokeCentral } from "@/lib/role-service";

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
export type StaffSearchResult = { hits: StaffHit[]; total: number };

const searchSchema = z.object({
  q: z.string().max(100),
  systemKey: z.string().max(50).optional(),
  forAdmin: z.boolean().optional(),
  line: z.enum(["", "academic", "support"]).optional(),
  branch: z.string().max(100).optional(),
  job: z.string().max(100).optional(),
});
type SearchInput = z.infer<typeof searchSchema>;

/** เงื่อนไขค้นหาร่วมของช่องเพิ่มคนและ "เพิ่มทั้งหมด": ตัดคนปิดใช้งาน และตัวผู้ค้นเอง (ตั้งสิทธิ์ตัวเองไม่ได้) */
async function buildSearch(actor: Actor, input: SearchInput): Promise<StaffSearch | null> {
  const { q, systemKey, forAdmin, line, branch, job } = input;
  if (forAdmin && !isCentral(actor)) return null;
  let system: SystemDef | undefined;
  if (systemKey) {
    system = (await getSystem(systemKey)) ?? undefined;
    if (!system || !canViewSystem(actor, systemKey)) return null;
  }
  const inactive = (await prisma.userStatus.findMany({ where: { status: "inactive" }, select: { userId: true } })).map((r) => r.userId);
  const filter: StaffFilter = {
    line: line || undefined,
    branch: branch || undefined,
    job: job || undefined,
    excludeIds: forAdmin ? inactive : [...inactive, actor.userId],
  };
  return { q, withoutRoleIn: forAdmin ? undefined : system, filter };
}

/**
 * ค้นหาบุคลากรสำหรับช่อง "เพิ่มคน" / "แต่งตั้งผู้ดูแล" (ไม่ส่งรายชื่อทั้งหมดไปเบราว์เซอร์)
 * systemKey: ตัดคนที่มีสิทธิ์ในระบบนั้นแล้ว และตรวจว่าผู้ค้นจัดการระบบนั้นได้ · total = จำนวนที่ตรงทั้งหมดในฐาน
 */
export async function searchStaffAction(input: unknown): Promise<StaffSearchResult> {
  const actor = await requireActor();
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { hits: [], total: 0 };
  const search = await buildSearch(actor, parsed.data);
  if (!search) return { hits: [], total: 0 };
  const { rows, total } = await searchStaff({ ...search, limit: 50 });
  return {
    hits: rows.map((r) => ({ id: r.id, name: r.name ?? "—", email: blankToNull(r.email), branch: blankToNull(r.branch) })),
    total,
  };
}

const ADD_ALL_MAX = 500;

/** ตั้งสิทธิ์ระบบหนึ่งให้ทุกคนที่ตรงคำค้นและตัวกรอง (ที่ยังไม่มีสิทธิ์) ในครั้งเดียว — ผ่านการตรวจเดียวกับ saveRoles */
export async function addAllMatching(input: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  const parsed = searchSchema.extend({ systemKey: z.string().max(50), value: z.number().int().min(1).max(999) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง โหลดหน้าใหม่แล้วลองอีกครั้ง" };
  const { value, ...rest } = parsed.data;
  const search = await buildSearch(actor, { ...rest, forAdmin: false });
  if (!search) return { ok: false, error: "ท่านไม่ได้ดูแลระบบนี้" };
  const ids = await searchStaffIds(search, ADD_ALL_MAX);
  if (ids.length === 0) return { ok: false, error: "ไม่มีใครตรงกับเงื่อนไข" };
  if (ids.length > ADD_ALL_MAX) return { ok: false, error: `ตรงเงื่อนไขเกิน ${ADD_ALL_MAX} คน กรองให้แคบลงก่อน` };
  const r = await applyRoleChanges(
    actor,
    ids.map((userId) => ({ userId, systemKey: rest.systemKey, value })),
    { skipDeactivated: true },
  );
  if (!r.ok) return r;
  refresh();
  return { ok: true, message: `เพิ่มแล้ว ${r.changed} คน${r.skipped ? ` · ข้าม ${r.skipped} คน (ปิดใช้งาน)` : ""}` };
}

/** แต่งตั้ง/ถอนผู้ดูแลกลาง (spec 3.2) — ตรวจซ้ำทั้งหมดใน role-service */
export async function addCentralAdmin(userId: number): Promise<ActionResult> {
  const actor = await requireActor();
  if (!id.safeParse(userId).success) return { ok: false, error: "เลือกบุคลากรก่อน" };
  const r = await assignCentral(actor, userId);
  if (!r.ok) return r;
  refresh();
  return { ok: true, message: r.changed ? "แต่งตั้งเป็นผู้ดูแลกลางแล้ว มีผลทันที" : "เป็นผู้ดูแลกลางอยู่แล้ว" };
}

export async function removeCentralAdmin(userId: number): Promise<ActionResult> {
  const actor = await requireActor();
  if (!id.safeParse(userId).success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const r = await revokeCentral(actor, userId);
  if (!r.ok) return r;
  refresh();
  return { ok: true, message: r.changed ? "ถอนผู้ดูแลกลางแล้ว" : "ไม่ได้เป็นผู้ดูแลกลางอยู่แล้ว" };
}

// ตรวจคำขอตั้งสิทธิ์ทีละรายการ (spec 3.1, 4.4, 7) — ไม่แตะฐานข้อมูล ทดสอบได้

import { canSetRole, type Actor } from "./roles";
import type { Level } from "./systems";

export type RoleChange = { userId: number; systemKey: string; value: number | null };

export type RoleCheck =
  | { ok: true; kind: "change" | "same" }
  | { ok: false; reason: "no_system" | "inactive_system" | "forbidden" | "not_staff" | "deactivated" | "bad_level" };

export function checkRoleChange(input: {
  actor: Actor;
  change: RoleChange;
  system: { key: string; active: boolean; levels: Level[] } | null;
  targetExists: boolean;
  targetInactive: boolean;
  current: number | null;
}): RoleCheck {
  const { actor, change, system, current } = input;
  if (!system) return { ok: false, reason: "no_system" };
  if (!system.active) return { ok: false, reason: "inactive_system" };
  if (!canSetRole(actor, system.key, change.userId)) return { ok: false, reason: "forbidden" };
  if (!input.targetExists) return { ok: false, reason: "not_staff" }; // ไม่มีแถว หรือเป็นนักศึกษา
  if (input.targetInactive) return { ok: false, reason: "deactivated" };
  if (change.value === current) return { ok: true, kind: "same" };
  // ค่าใหม่ต้องเป็น "ไม่มีสิทธิ์" หรือระดับที่ลงทะเบียน ห้ามพิมพ์ตัวเลขเอง (spec 4.4)
  if (change.value !== null && !system.levels.some((l) => l.value === change.value)) {
    return { ok: false, reason: "bad_level" };
  }
  return { ok: true, kind: "change" };
}

export const ROLE_REASON_TEXT: Record<Exclude<RoleCheck, { ok: true }>["reason"], string> = {
  no_system: "ไม่พบระบบนี้",
  inactive_system: "ระบบนี้ถูกซ่อนจากหน้าจอ ตั้งสิทธิ์ไม่ได้",
  forbidden: "ท่านตั้งสิทธิ์ของระบบนี้ให้คนนี้ไม่ได้",
  not_staff: "ไม่พบบุคลากรคนนี้",
  deactivated: "คนนี้ถูกปิดใช้งาน ต้องเปิดใช้งานอีกครั้งก่อน",
  bad_level: "ระดับนี้ไม่ได้ลงทะเบียนไว้",
};

/**
 * ถอนผู้ดูแลกลางได้ไหม (spec 3.2): ถอนตัวเองไม่ได้ และต้องเหลือผู้ดูแลกลางที่ใช้งานอยู่อย่างน้อย 1 คน
 * activeOthers = ผู้ดูแลกลางที่ใช้งานอยู่ ไม่นับคนที่จะถอน
 */
export function checkCentralRevoke(input: { actorId: number; targetId: number; activeOthers: number }): { ok: true } | { ok: false; error: string } {
  if (input.targetId === input.actorId) return { ok: false, error: "ถอนตัวเองไม่ได้ ให้ผู้ดูแลกลางคนอื่นถอนให้" };
  if (input.activeOthers < 1) return { ok: false, error: "ต้องมีผู้ดูแลกลางที่ใช้งานอยู่อย่างน้อย 1 คน" };
  return { ok: true };
}

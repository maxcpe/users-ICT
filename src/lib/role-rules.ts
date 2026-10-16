// ตรวจคำขอตั้งสิทธิ์ทีละรายการ (spec 3.1, 4.4, 7) — ไม่แตะฐานข้อมูล ทดสอบได้

import { canSetRole, type Actor } from "./roles";
import type { Level } from "./systems";

/**
 * value: ระบบปกติ (null = ไม่มีสิทธิ์)
 * levels: ระบบหลายสิทธิ์ (spec 2.3) ชุดบทบาททั้งหมดหลังเปลี่ยน ([] = ไม่มีสิทธิ์)
 */
export type RoleChange = { userId: number; systemKey: string; value: number | null; levels?: number[] };

/** เรียงและตัดค่าซ้ำ ใช้เทียบชุดบทบาท */
export function normalizeLevels(levels: readonly number[]): number[] {
  return [...new Set(levels)].sort((a, b) => a - b);
}

export function sameLevels(a: readonly number[], b: readonly number[]): boolean {
  const x = normalizeLevels(a);
  const y = normalizeLevels(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

export type RoleCheck =
  | { ok: true; kind: "change" | "same" }
  | { ok: false; reason: "no_system" | "inactive_system" | "forbidden" | "not_staff" | "deactivated" | "bad_level" };

export function checkRoleChange(input: {
  actor: Actor;
  change: RoleChange;
  system: { key: string; active: boolean; levels: Level[]; multi?: boolean } | null;
  targetExists: boolean;
  targetInactive: boolean;
  current: number | null;
  /** ระบบหลายสิทธิ์: บทบาทปัจจุบันทั้งหมด */
  currentSet?: number[];
}): RoleCheck {
  const { actor, change, system, current } = input;
  if (!system) return { ok: false, reason: "no_system" };
  if (!system.active) return { ok: false, reason: "inactive_system" };
  if (!canSetRole(actor, system.key, change.userId)) return { ok: false, reason: "forbidden" };
  if (!input.targetExists) return { ok: false, reason: "not_staff" }; // ไม่มีแถว หรือเป็นนักศึกษา
  if (input.targetInactive) return { ok: false, reason: "deactivated" };
  if (system.multi) {
    // ระบบหลายสิทธิ์ต้องส่งชุดบทบาท และทุกบทบาทต้องลงทะเบียน (ค่าอื่นที่มีอยู่แล้วคงไว้ได้)
    if (!change.levels) return { ok: false, reason: "bad_level" };
    const before = input.currentSet ?? [];
    if (sameLevels(change.levels, before)) return { ok: true, kind: "same" };
    const added = normalizeLevels(change.levels).filter((v) => !before.includes(v));
    if (added.some((v) => !system.levels.some((l) => l.value === v))) return { ok: false, reason: "bad_level" };
    return { ok: true, kind: "change" };
  }
  if (change.levels) return { ok: false, reason: "bad_level" }; // ระบบปกติรับค่าเดียว
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

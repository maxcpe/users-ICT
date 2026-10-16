// บทบาทในระบบนี้และขอบเขตของแต่ละบทบาท (spec 3) — ไม่แตะฐานข้อมูล

import { USERS_SYSTEM_KEY } from "./systems";

export const CENTRAL_LEVEL = 99;
export const SYSTEM_ADMIN_LEVEL = 50;

export type Role = "central" | "system";

export type Actor = {
  userId: number;
  name: string;
  email: string;
  role: Role;
  /** ระบบที่ดูแล (จาก system_admins) ผู้ดูแลกลางไม่ใช้ค่านี้ */
  systems: string[];
};

/** ระดับใน user_roles ของระบบ `users` → บทบาท ค่าอื่นหรือไม่มีแถว = เข้าไม่ได้ */
export function roleFromLevel(level: number | null | undefined): Role | null {
  if (level === CENTRAL_LEVEL) return "central";
  if (level === SYSTEM_ADMIN_LEVEL) return "system";
  return null;
}

export const isCentral = (a: Actor) => a.role === "central";

/** ระบบที่ actor เห็นบนหน้าจอ */
export function canViewSystem(actor: Actor, key: string): boolean {
  if (isCentral(actor)) return true;
  return key !== USERS_SYSTEM_KEY && actor.systems.includes(key);
}

/**
 * ตั้งสิทธิ์ของ `key` ให้ `targetId` ได้ไหม (spec 3.1, 7)
 * ยังไม่รวมเงื่อนไขที่ต้องอ่านฐาน (ปิดใช้งาน, นักศึกษา) — ผู้เรียกต้องตรวจเพิ่ม
 */
export function canSetRole(actor: Actor, key: string, targetId: number): boolean {
  if (key === USERS_SYSTEM_KEY) return false; // ตั้งผ่านการแต่งตั้งผู้ดูแล (4.6) เท่านั้น
  if (isCentral(actor)) return true;
  return actor.systems.includes(key) && actor.userId !== targetId;
}

export const canManageRegistry = (a: Actor) => isCentral(a);
export const canSeeSensitive = (a: Actor) => isCentral(a);

// กติกาการเข้าสู่ระบบ (spec 3, 5.5) — ไม่แตะฐานข้อมูล ทดสอบได้

import { roleFromLevel } from "./roles";

export const ALLOWED_EMAIL_DOMAIN = "@up.ac.th";

export type LoginDenyReason =
  | "domain" // ไม่ใช่บัญชี @up.ac.th
  | "not_found" // ไม่พบในทะเบียนบุคลากร
  | "duplicate_email" // อีเมลนี้มีมากกว่า 1 แถว
  | "identity_mismatch" // แถวนี้ผูกกับบัญชี 365 อื่นอยู่แล้ว
  | "inactive" // ถูกปิดใช้งาน
  | "denied"; // ไม่มีสิทธิ์ในระบบนี้

export type LoginFacts = {
  email: string;
  /** U_id ที่ผูกกับ oid นี้ใน user_identity (ถ้ามี) */
  identityUserId: number | null;
  /** U_id ของแถวที่อีเมลตรง (ไม่รวมนักศึกษา) */
  emailMatches: number[];
  /** oid ที่ผูกกับแถวที่อีเมลตรงอยู่แล้ว (ถ้ามี) */
  boundOidForMatch: string | null;
  oid: string;
};

export type LoginDecision = { ok: true; userId: number; bind: boolean } | { ok: false; reason: LoginDenyReason };

/**
 * ขั้นที่ 1: หาว่าเป็นใคร
 * - ถ้า oid เคยผูกกับ U_id ใช้ U_id นั้น แม้อีเมลเปลี่ยน (spec 5.5)
 * - ไม่งั้นจับคู่ด้วยอีเมล ต้องตรง 1 แถวพอดี และแถวนั้นต้องไม่ผูกกับบัญชีอื่น
 */
export function identify(f: LoginFacts): LoginDecision {
  if (!f.email.endsWith(ALLOWED_EMAIL_DOMAIN)) return { ok: false, reason: "domain" };
  if (f.identityUserId !== null) return { ok: true, userId: f.identityUserId, bind: false };
  if (f.emailMatches.length === 0) return { ok: false, reason: "not_found" };
  if (f.emailMatches.length > 1) return { ok: false, reason: "duplicate_email" };
  if (f.boundOidForMatch !== null && f.boundOidForMatch !== f.oid) return { ok: false, reason: "identity_mismatch" };
  return { ok: true, userId: f.emailMatches[0]!, bind: f.boundOidForMatch === null };
}

/** ขั้นที่ 2: มีสิทธิ์เข้าระบบนี้ไหม */
export function authorize(level: number | null, inactive: boolean): LoginDenyReason | null {
  if (inactive) return "inactive";
  return roleFromLevel(level) ? null : "denied";
}

export const LOGIN_ERROR_TEXT: Record<LoginDenyReason, string> = {
  domain: "ใช้ได้เฉพาะบัญชี @up.ac.th ของมหาวิทยาลัย",
  not_found: "ไม่พบบัญชีนี้ในทะเบียนบุคลากรของคณะ ติดต่อผู้ดูแลกลาง",
  duplicate_email: "อีเมลนี้ซ้ำกันหลายแถวในทะเบียน ติดต่อผู้ดูแลกลางให้แก้ก่อน",
  identity_mismatch: "แถวในทะเบียนนี้ผูกกับบัญชี Microsoft 365 อื่นอยู่แล้ว ติดต่อผู้ดูแลกลาง",
  inactive: "บัญชีนี้ถูกปิดใช้งานในระบบของคณะ",
  denied: "บัญชีนี้ยังไม่มีสิทธิ์เข้าระบบนี้ ถ้าต้องดูแลระบบใด ให้ติดต่อผู้ดูแลกลาง",
};

export function isLoginDenyReason(v: string | undefined): v is LoginDenyReason {
  return v !== undefined && v in LOGIN_ERROR_TEXT;
}

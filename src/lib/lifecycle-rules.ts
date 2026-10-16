// กติกาปิดใช้งาน ลบแถว และการปิดบังข้อมูลอ่อนไหว (spec 3.2, 4.5, 4.5.1, 6.2) — ไม่แตะฐานข้อมูล ทดสอบได้

export const DEACTIVATE_REASONS = ["ลาออก", "ย้ายสังกัด", "หมดสัญญา", "อื่น ๆ"] as const;
export const DELETE_WINDOW_DAYS = 7;

/** วันที่ปัจจุบันตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function bangkokToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

export function checkDeactivate(f: {
  actorId: number;
  targetId: number;
  alreadyInactive: boolean;
  targetIsCentral: boolean;
  /** ผู้ดูแลกลางที่ยังใช้งานอยู่ ไม่นับคนที่จะปิด */
  otherActiveCentrals: number;
  effectiveDate: string;
  today: string;
}): string | null {
  if (f.actorId === f.targetId) return "ปิดใช้งานตัวเองไม่ได้";
  if (f.alreadyInactive) return "คนนี้ถูกปิดใช้งานอยู่แล้ว";
  if (f.targetIsCentral && f.otherActiveCentrals < 1) return "ปิดใช้งานผู้ดูแลกลางคนสุดท้ายไม่ได้ ต้องแต่งตั้งคนอื่นก่อน";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.effectiveDate)) return "วันที่มีผลไม่ถูกต้อง";
  if (f.effectiveDate < f.today) return "วันที่มีผลต้องเป็นวันนี้หรือหลังจากนี้";
  return null;
}

/** ปิดทันทีหรือรอวัน (spec 4.5 ปิดใช้งานล่วงหน้า) */
export const isScheduled = (effectiveDate: string, today: string) => effectiveDate > today;

export type DeleteFacts = {
  /** เวลาที่เพิ่มผ่านระบบนี้ (user.create ใน audit log) ไม่มี = มีอยู่ก่อนระบบนี้ */
  createdAt: Date | null;
  now: Date;
  /** คอลัมน์สิทธิ์ใน user.user ที่ยังมีค่า (รวมคอลัมน์ที่ไม่อยู่ในทะเบียน) */
  nonNullRoleColumns: string[];
  tableRoleCount: number;
  adminCount: number;
  hasIdentity: boolean;
};

/** เหตุผลที่ลบไม่ได้ (ว่าง = ลบได้) — spec 4.5.1 */
export function deleteBlockers(f: DeleteFacts): string[] {
  const out: string[] = [];
  if (!f.createdAt) out.push("แถวนี้มีอยู่ก่อนระบบนี้ ไม่ได้เพิ่มผ่านระบบนี้");
  else if (f.now.getTime() - f.createdAt.getTime() > DELETE_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    out.push(`เพิ่มมาเกิน ${DELETE_WINDOW_DAYS} วันแล้ว ระบบอื่นอาจเก็บรหัสผู้ใช้นี้ไว้`);
  }
  if (f.nonNullRoleColumns.length || f.tableRoleCount) out.push("ยังมีสิทธิ์ในบางระบบ ต้องถอนสิทธิ์ทุกระบบก่อน");
  if (f.adminCount) out.push("ยังเป็นผู้ดูแลระบบ ต้องถอนก่อน");
  if (f.hasIdentity) out.push("เคยเข้าสู่ระบบนี้แล้ว");
  return out;
}

/** RFID: แสดง 4 ตัวท้าย */
export function maskRfid(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length <= 4 ? "•".repeat(t.length) : `•••• ${t.slice(-4)}`;
}

/** เบอร์โทร: แสดงตัวแรกกับ 3 ตัวท้าย ที่เหลือเป็นจุด คงขีดไว้ */
export function maskPhone(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  const digits = [...t].filter((c) => /\d/.test(c)).length;
  if (digits <= 4) return t.replace(/\d/g, "•");
  let seen = 0;
  return [...t]
    .map((c) => {
      if (!/\d/.test(c)) return c;
      seen++;
      return seen === 1 || seen > digits - 3 ? c : "•";
    })
    .join("");
}

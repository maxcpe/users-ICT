// เลขบัตรประชาชน → HMAC (spec 6.1)
// ต้องคำนวณแบบเดียวกับ backend ระบบลงทะเบียนเป๊ะ ไม่งั้นจับคู่คนไม่ได้
// ยังไม่รู้ว่าระบบนั้นใช้คีย์แบบข้อความหรือ hex และใช้เลขมีขีดหรือไม่ จึงมี "แบบ" ให้ตรวจกับค่าจริงก่อน (spec 13 ข้อ 1)

import { createHmac, timingSafeEqual } from "node:crypto";
import { HMAC_MODES, type HmacMode } from "./idcard-modes";

/** ตรวจ check digit ของเลขบัตรประชาชนไทย 13 หลัก */
export function isValidThaiId(raw: string): boolean {
  const d = raw.replace(/[\s-]/g, "");
  if (!/^\d{13}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

export const digitsOnly = (raw: string) => raw.replace(/\D/g, "");

/** x-xxxx-xxxxx-xx-x */
export function dashed(d: string): string {
  return `${d.slice(0, 1)}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d.slice(12)}`;
}

export { HMAC_MODES, type HmacMode } from "./idcard-modes";

/**
 * แบบที่ตรวจกับค่าจริงแล้ว — null = ยังไม่รู้ ห้ามบันทึกเลขบัตร
 * ยืนยัน 9 ต.ค. 2569: กด "ตรวจคีย์" กับแถวจริงแล้วตรงกับค่าในฐาน (คีย์เป็นข้อความ เลข 13 หลักล้วน)
 */
export const CONFIRMED_HMAC_MODE: HmacMode | null = "text-digits";

export function computeHmac(idDigits: string, key: string, mode: HmacMode): string {
  const keyBytes = mode.startsWith("hex") ? Buffer.from(key, "hex") : Buffer.from(key, "utf8");
  const input = mode.endsWith("dashed") ? dashed(idDigits) : idDigits;
  return createHmac("sha256", keyBytes).update(input, "utf8").digest("hex");
}

/** แบบที่ให้ผลตรงกับค่าที่เก็บไว้ (เทียบแบบ constant-time) */
export function matchingModes(idDigits: string, key: string, stored: string): HmacMode[] {
  const target = Buffer.from(stored.trim().toLowerCase(), "utf8");
  return (Object.keys(HMAC_MODES) as HmacMode[]).filter((m) => {
    if (m.startsWith("hex") && !/^[0-9a-fA-F]+$/.test(key)) return false;
    const got = Buffer.from(computeHmac(idDigits, key, m), "utf8");
    return got.length === target.length && timingSafeEqual(got, target);
  });
}

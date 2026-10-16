// ชื่อแบบการคำนวณ HMAC แยกจาก idcard.ts เพื่อให้หน้าจอฝั่ง client import ได้ (idcard.ts ใช้ node:crypto)

export const HMAC_MODES = {
  "text-digits": "คีย์เป็นข้อความ · เลข 13 หลักล้วน",
  "hex-digits": "คีย์แปลงจาก hex · เลข 13 หลักล้วน",
  "text-dashed": "คีย์เป็นข้อความ · เลขมีขีด",
  "hex-dashed": "คีย์แปลงจาก hex · เลขมีขีด",
} as const;
export type HmacMode = keyof typeof HMAC_MODES;

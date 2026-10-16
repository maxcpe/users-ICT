import "server-only";
// RFID และเบอร์โทร (spec 6.2) — ผู้ดูแลกลางเท่านั้น การ "แสดง" ทุกครั้งบันทึก audit log
// audit บันทึกแค่ว่าแก้/ดู ไม่บันทึกค่า (spec 7)

import { writeAudit } from "./audit";
import { prisma } from "./db";
import { computeHmac, CONFIRMED_HMAC_MODE, digitsOnly, isValidThaiId, matchingModes, type HmacMode } from "./idcard";
import { idcardOwners, readIdcardHmac, readSensitive, ReadOnlyUserDbError, rfidOwners, writeSensitive } from "./registry";
import { canSeeSensitive, type Actor } from "./roles";

export type SensitiveField = "rfid" | "tel";
const COLUMN = { rfid: "U_rfid", tel: "U_tel" } as const;
const LABEL = { rfid: "RFID", tel: "เบอร์โทร" } as const;

const RFID_RE = /^[0-9A-Za-z]{1,32}$/;
const TEL_RE = /^[0-9+\-\s(),#]{1,30}$/;

export async function revealSensitive(actor: Actor, userId: number, field: SensitiveField): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> {
  if (!canSeeSensitive(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  const s = await readSensitive(userId);
  if (!s) return { ok: false, error: "ไม่พบบุคลากรคนนี้" };
  await prisma.$transaction(async (tx) =>
    writeAudit(tx, { actorId: actor.userId, action: "sensitive.view", targetId: userId, changes: { [COLUMN[field]]: "viewed" } }),
  );
  return { ok: true, value: s[field] };
}

export async function updateSensitiveField(
  actor: Actor,
  userId: number,
  field: SensitiveField,
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canSeeSensitive(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  const value = raw.trim() === "" ? null : raw.trim();
  if (value !== null && !(field === "rfid" ? RFID_RE : TEL_RE).test(value)) {
    return { ok: false, error: field === "rfid" ? "RFID ใช้ได้เฉพาะตัวเลขและตัวอักษรอังกฤษ ไม่เกิน 32 ตัว" : "เบอร์โทรใช้ได้เฉพาะตัวเลข ขีด และวงเล็บ" };
  }
  if (!(await readSensitive(userId))) return { ok: false, error: "ไม่พบบุคลากรคนนี้" };
  try {
    return await prisma.$transaction(async (tx) => {
      if (field === "rfid" && value !== null && (await rfidOwners(tx, value, userId)).length) {
        return { ok: false as const, error: "RFID นี้ผูกกับผู้ใช้อื่นแล้ว" };
      }
      await writeSensitive(tx, userId, COLUMN[field], value);
      await writeAudit(tx, { actorId: actor.userId, action: "sensitive.update", targetId: userId, changes: { [COLUMN[field]]: value === null ? "cleared" : "changed" } });
      return { ok: true as const };
    });
  } catch (e) {
    if (e instanceof ReadOnlyUserDbError) return { ok: false, error: e.message };
    throw e;
  }
}

export const SENSITIVE_LABEL = LABEL;

// ---------- เลขบัตรประชาชน (spec 6.1) ห้ามเก็บ ห้าม log ห้ามส่งเลขหรือ HMAC กลับไปหน้าจอ ----------

function hmacKey(): string | null {
  const k = process.env.IDCARD_HMAC_KEY?.trim();
  return k ? k : null;
}

/** ตรวจว่าคีย์และวิธีคำนวณตรงกับค่าที่ระบบลงทะเบียนเก็บไว้ ไม่บันทึกอะไร */
export async function checkIdcard(
  actor: Actor,
  userId: number,
  raw: string,
): Promise<{ ok: true; modes: HmacMode[] } | { ok: false; error: string }> {
  if (!canSeeSensitive(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  if (!isValidThaiId(raw)) return { ok: false, error: "เลขบัตรไม่ถูกต้อง (13 หลัก check digit ต้องตรง)" };
  const key = hmacKey();
  if (!key) return { ok: false, error: "ยังไม่ได้ตั้ง IDCARD_HMAC_KEY ใน .env" };
  const stored = await readIdcardHmac(userId);
  if (!stored) return { ok: false, error: "แถวนี้ยังไม่มีค่าเลขบัตร ให้ตรวจกับคนที่มีค่าอยู่แล้ว" };
  const modes = matchingModes(digitsOnly(raw), key, stored);
  await prisma.$transaction(async (tx) =>
    writeAudit(tx, { actorId: actor.userId, action: "sensitive.check", targetId: userId, changes: { U_idcard_hmac: modes.length ? "matched" : "not_matched" } }),
  );
  return { ok: true, modes };
}

/** ตั้งหรือล้างเลขบัตร (raw ว่าง = ล้าง) ใช้ได้เมื่อยืนยันวิธีคำนวณแล้วเท่านั้น */
export async function setIdcard(actor: Actor, userId: number, raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canSeeSensitive(actor)) return { ok: false, error: "เฉพาะผู้ดูแลกลาง" };
  const clear = raw.trim() === "";
  if (!clear && !CONFIRMED_HMAC_MODE) return { ok: false, error: "ยังไม่ได้ยืนยันวิธีคำนวณ HMAC กด \"ตรวจคีย์\" กับแถวที่มีค่าอยู่แล้วก่อน" };
  if (!clear && !isValidThaiId(raw)) return { ok: false, error: "เลขบัตรไม่ถูกต้อง (13 หลัก check digit ต้องตรง)" };
  const key = hmacKey();
  if (!clear && !key) return { ok: false, error: "ยังไม่ได้ตั้ง IDCARD_HMAC_KEY ใน .env" };
  const hmac = clear ? null : computeHmac(digitsOnly(raw), key!, CONFIRMED_HMAC_MODE!);
  try {
    return await prisma.$transaction(async (tx) => {
      if (hmac && (await idcardOwners(tx, hmac, userId)).length) {
        // ไม่บอกว่าเป็นใคร (spec 6.1)
        return { ok: false as const, error: "เลขนี้ผูกกับผู้ใช้อื่นแล้ว" };
      }
      await writeSensitive(tx, userId, "U_idcard_hmac", hmac);
      await writeAudit(tx, { actorId: actor.userId, action: "sensitive.update", targetId: userId, changes: { U_idcard_hmac: clear ? "cleared" : "changed" } });
      return { ok: true as const };
    });
  } catch (e) {
    if (e instanceof ReadOnlyUserDbError) return { ok: false, error: e.message };
    throw e;
  }
}

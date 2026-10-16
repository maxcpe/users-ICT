// กฎของทะเบียนระบบและระดับสิทธิ์ (spec 5.1) — ไม่แตะฐานข้อมูล

import { z } from "zod";

export const USERS_SYSTEM_KEY = "users";
export const SYSTEM_KEY_RE = /^[a-z][a-z0-9_]{1,49}$/;
export const ROLE_COLUMN_RE = /^U_[a-z]+$/;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 999;

export const levelSchema = z.object({
  value: z.number().int().min(LEVEL_MIN).max(LEVEL_MAX),
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().max(120).optional(),
});
export type Level = z.infer<typeof levelSchema>;

const levelsSchema = z.array(levelSchema);

/** อ่าน levels จาก JSON ในฐาน ค่าเสียให้ถือว่าไม่มีระดับ (หน้าจอจะแสดงทุกค่าเป็น "ค่าอื่น") */
export function parseLevels(json: unknown): Level[] {
  const parsed = levelsSchema.safeParse(json);
  if (!parsed.success) return [];
  return [...parsed.data].sort((a, b) => a.value - b.value);
}

export type LevelDisplay =
  | { kind: "none" }
  | { kind: "known"; value: number; label: string; top: boolean }
  | { kind: "other"; value: number };

/** แปลงค่าในฐานเป็นสิ่งที่แสดงบนหน้าจอ ค่าที่ไม่ได้ลงทะเบียนต้องแสดงเป็น "ค่าอื่น (n)" ห้ามทิ้ง */
export function describeLevel(levels: Level[], value: number | null | undefined): LevelDisplay {
  if (value === null || value === undefined) return { kind: "none" };
  const found = levels.find((l) => l.value === value);
  if (!found) return { kind: "other", value };
  const top = levels[levels.length - 1]?.value === value;
  return { kind: "known", value, label: found.label, top };
}

export function isValidSystemKey(key: string): boolean {
  return SYSTEM_KEY_RE.test(key) && key !== USERS_SYSTEM_KEY;
}

/**
 * ชื่อคอลัมน์สิทธิ์ใช้ใน SQL ได้ก็ต่อเมื่อตรงรูปแบบและมีอยู่จริงในตาราง (spec 7)
 * `existing` คือรายชื่อคอลัมน์ที่อ่านจาก information_schema ตอนเริ่มแอป
 */
export function isAllowedRoleColumn(name: string, existing: ReadonlySet<string>): boolean {
  return ROLE_COLUMN_RE.test(name) && existing.has(name);
}

export type LevelChangeError =
  | { code: "empty" }
  | { code: "duplicate"; value: number }
  | { code: "in_use"; value: number; count: number };

/**
 * ตรวจการแก้ระดับ: ต้องมีอย่างน้อย 1 ระดับ ค่าห้ามซ้ำ
 * และระดับที่มีคนใช้อยู่จะหายไปไม่ได้ (spec 5.1 แก้ระดับ)
 */
export function checkLevelChange(
  next: Level[],
  inUse: ReadonlyMap<number, number>,
): LevelChangeError[] {
  const errors: LevelChangeError[] = [];
  if (next.length === 0) errors.push({ code: "empty" });
  const seen = new Set<number>();
  for (const l of next) {
    if (seen.has(l.value)) errors.push({ code: "duplicate", value: l.value });
    seen.add(l.value);
  }
  for (const [value, count] of inUse) {
    if (count > 0 && !seen.has(value)) errors.push({ code: "in_use", value, count });
  }
  return errors;
}

export function levelChangeMessage(e: LevelChangeError): string {
  switch (e.code) {
    case "empty":
      return "ต้องมีอย่างน้อย 1 ระดับ";
    case "duplicate":
      return `ค่า ${e.value} ซ้ำกัน`;
    case "in_use":
      return `ระดับ ${e.value} มีคนใช้อยู่ ${e.count} คน ลบหรือเปลี่ยนค่าไม่ได้ ต้องย้ายคนไประดับอื่นก่อน`;
  }
}

/** ข้อความของชุดบทบาท (ระบบหลายสิทธิ์, spec 2.3) เช่น "ผู้ใช้งาน, ฝ่ายบุคคล" — ว่าง = "ไม่มีสิทธิ์" */
export function levelSetText(levels: Level[], values: readonly number[]): string {
  if (!values.length) return "ไม่มีสิทธิ์";
  return [...values]
    .sort((a, b) => a - b)
    .map((v) => {
      const d = describeLevel(levels, v);
      return d.kind === "known" ? d.label : `ค่าอื่น (${v})`;
    })
    .join(", ");
}

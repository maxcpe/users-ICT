"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireCentral } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { levelCounts } from "@/lib/registry";
import { getSystem } from "@/lib/system-repo";
import { checkLevelChange, isValidSystemKey, levelChangeMessage, levelSchema, USERS_SYSTEM_KEY, type Level } from "@/lib/systems";
import { SYSTEM_ICON_KEYS } from "@/lib/system-icons";

export type FormState = { ok?: boolean; error?: string; fields?: Record<string, string> } | undefined;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const infoSchema = z.object({
  name: z.string().trim().min(1, "กรอกชื่อที่แสดง").max(100),
  // ไอคอนต้องเป็นชื่อในรายการ (design.md 5.18) ไม่รับอีโมจิหรือข้อความอื่น
  icon: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(SYSTEM_ICON_KEYS).nullable()),
  url: optionalText(255).refine((v) => v === null || /^https:\/\//.test(v), "ลิงก์ต้องขึ้นต้นด้วย https://"),
  note: optionalText(255),
});

function parseLevelsField(raw: FormDataEntryValue | null): Level[] | string {
  try {
    const parsed = z.array(levelSchema).safeParse(JSON.parse(String(raw ?? "[]")));
    if (!parsed.success) return "ระดับไม่ถูกต้อง: ค่าต้องเป็นเลข 1–999 และต้องมีชื่อที่แสดง";
    return parsed.data
      .map((l) => ({ ...l, description: l.description || undefined }))
      .sort((a, b) => a.value - b.value);
  } catch {
    return "ระดับไม่ถูกต้อง";
  }
}

function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const k = String(issue.path[0] ?? "form");
    out[k] ??= issue.message;
  }
  return out;
}

/** ลงทะเบียนระบบใหม่ — เก็บใน user_roles เสมอ ใช้ได้ทันที (spec 5.1) */
export async function createSystem(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireCentral();
  const key = String(form.get("key") ?? "").trim();
  const info = infoSchema.safeParse(Object.fromEntries(form));
  const levels = parseLevelsField(form.get("levels"));

  const fields: Record<string, string> = info.success ? {} : fieldErrors(info.error);
  if (!isValidSystemKey(key)) fields.key = "key ใช้ได้เฉพาะ a–z ตัวเลข และ _ ขึ้นต้นด้วยตัวอักษร ยาว 2–50 ตัว (ใช้ users ไม่ได้)";
  if (typeof levels === "string") fields.levels = levels;
  else {
    const errs = checkLevelChange(levels, new Map());
    if (errs.length) fields.levels = errs.map(levelChangeMessage).join(" · ");
  }
  if (Object.keys(fields).length || !info.success || typeof levels === "string") return { fields };

  try {
    await prisma.$transaction(async (tx) => {
      const max = await tx.system.aggregate({ _max: { sortOrder: true }, where: { key: { not: USERS_SYSTEM_KEY } } });
      await tx.system.create({
        data: {
          key,
          storage: "table",
          ...info.data,
          levels,
          sortOrder: (max._max.sortOrder ?? 0) + 10,
        },
      });
      await writeAudit(tx, { actorId: actor.userId, action: "system.create", systemKey: key, changes: { ...info.data, levels } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fields: { key: `มีระบบที่ใช้ key "${key}" อยู่แล้ว` } };
    }
    throw e;
  }
  revalidatePath("/systems");
  redirect(`/systems/${key}/connect?created=1`);
}

/** แก้ระดับ — ระดับที่มีคนใช้อยู่ลบหรือเปลี่ยนค่าไม่ได้ (spec 5.1) */
export async function saveLevels(key: string, _prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireCentral();
  const system = await getSystem(key);
  if (!system || key === USERS_SYSTEM_KEY) return { error: "แก้ระดับของระบบนี้ไม่ได้" };

  const levels = parseLevelsField(form.get("levels"));
  if (typeof levels === "string") return { error: levels };

  return prisma.$transaction(async (tx) => {
    const errs = checkLevelChange(levels, await levelCounts(system, tx));
    if (errs.length) return { error: errs.map(levelChangeMessage).join(" · ") };
    await tx.system.update({ where: { key }, data: { levels } });
    await writeAudit(tx, {
      actorId: actor.userId,
      action: "system.levels",
      systemKey: key,
      changes: { levels: [system.levels, levels] },
    });
    revalidatePath(`/systems/${key}`, "layout");
    return { ok: true };
  });
}

/** ยืนยันความหมายของระดับกับเจ้าของระบบแล้ว */
export async function confirmLevels(key: string): Promise<void> {
  const actor = await requireCentral();
  await prisma.$transaction(async (tx) => {
    await tx.system.update({ where: { key }, data: { unconfirmed: false } });
    await writeAudit(tx, { actorId: actor.userId, action: "system.confirm", systemKey: key, changes: { unconfirmed: [true, false] } });
  });
  revalidatePath(`/systems/${key}`, "layout");
}

/** ชื่อ ไอคอน ลิงก์ หมายเหตุ และการแสดงบนหน้าจอ — ที่เก็บและคอลัมน์แก้ไม่ได้ */
export async function saveSettings(key: string, _prev: FormState, form: FormData): Promise<FormState> {
  const actor = await requireCentral();
  const before = await prisma.system.findUnique({ where: { key } });
  if (!before) return { error: "ไม่พบระบบนี้" };

  const info = infoSchema.safeParse(Object.fromEntries(form));
  if (!info.success) return { fields: fieldErrors(info.error) };
  const active = key === USERS_SYSTEM_KEY ? true : form.get("active") === "on";
  const next = { ...info.data, active };

  const diff: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(next) as (keyof typeof next)[]) {
    if (before[k] !== next[k]) diff[k] = [before[k], next[k]];
  }
  if (Object.keys(diff).length === 0) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.system.update({ where: { key }, data: next });
    await writeAudit(tx, { actorId: actor.userId, action: "system.update", systemKey: key, changes: diff as Prisma.InputJsonValue });
  });
  revalidatePath("/systems");
  revalidatePath(`/systems/${key}`, "layout");
  return { ok: true };
}

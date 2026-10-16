"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCentral } from "@/lib/access";
import { DEACTIVATE_REASONS } from "@/lib/lifecycle-rules";
import { clearSystem, deactivate, deleteStaff, reactivate, renameSystemKey, type Result } from "@/lib/lifecycle-service";
import { checkIdcard, revealSensitive, setIdcard, updateSensitiveField } from "@/lib/sensitive-service";

const id = z.number().int().positive();

function refresh() {
  revalidatePath("/", "layout");
}

export async function deactivateAction(userId: number, reason: string, effectiveDate: string): Promise<Result> {
  const actor = await requireCentral();
  if (!id.safeParse(userId).success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  if (!(DEACTIVATE_REASONS as readonly string[]).includes(reason)) return { ok: false, error: "เลือกเหตุผล" };
  const r = await deactivate(actor, userId, reason, effectiveDate);
  if (r.ok) refresh();
  return r;
}

export async function reactivateAction(userId: number, restoreKeys: string[]): Promise<Result> {
  const actor = await requireCentral();
  const parsed = z.array(z.string().max(50)).max(100).safeParse(restoreKeys);
  if (!id.safeParse(userId).success || !parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const r = await reactivate(actor, userId, parsed.data);
  if (r.ok) refresh();
  return r;
}

export async function deleteAction(userId: number, confirmation: string): Promise<Result> {
  const actor = await requireCentral();
  if (!id.safeParse(userId).success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const r = await deleteStaff(actor, userId, String(confirmation ?? ""));
  if (!r.ok) return r;
  refresh();
  redirect("/?deleted=1");
}

export async function clearSystemAction(key: string, confirmation: string): Promise<Result> {
  const actor = await requireCentral();
  const r = await clearSystem(actor, String(key), String(confirmation ?? ""));
  if (r.ok) refresh();
  return r;
}

const field = z.enum(["rfid", "tel"]);

export async function revealAction(userId: number, f: string): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> {
  const actor = await requireCentral();
  const parsed = field.safeParse(f);
  if (!id.safeParse(userId).success || !parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  return revealSensitive(actor, userId, parsed.data);
}

export async function updateSensitiveAction(userId: number, f: string, value: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireCentral();
  const parsed = field.safeParse(f);
  if (!id.safeParse(userId).success || !parsed.success) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const r = await updateSensitiveField(actor, userId, parsed.data, String(value ?? ""));
  if (r.ok) refresh();
  return r;
}

export async function renameKeyAction(oldKey: string, newKey: string): Promise<Result> {
  const actor = await requireCentral();
  const r = await renameSystemKey(actor, String(oldKey), String(newKey ?? ""));
  if (!r.ok) return r;
  refresh();
  redirect(`/systems/${r.key}/settings?renamed=1`);
}

// เลขบัตรประชาชน: ไม่คืนเลขหรือ HMAC ไปหน้าจอ ไม่ log
export async function checkIdcardAction(userId: number, raw: string) {
  const actor = await requireCentral();
  if (!id.safeParse(userId).success) return { ok: false as const, error: "ข้อมูลไม่ถูกต้อง" };
  return checkIdcard(actor, userId, String(raw ?? ""));
}

export async function setIdcardAction(userId: number, raw: string) {
  const actor = await requireCentral();
  if (!id.safeParse(userId).success) return { ok: false as const, error: "ข้อมูลไม่ถูกต้อง" };
  const r = await setIdcard(actor, userId, String(raw ?? ""));
  if (r.ok) refresh();
  return r;
}

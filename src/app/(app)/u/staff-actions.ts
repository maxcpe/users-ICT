"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCentral } from "@/lib/access";
import { createStaff, editStaff } from "@/lib/staff-service";
import { staffSchema } from "@/lib/staff-rules";

export type StaffFormState =
  | {
      ok?: boolean;
      error?: string;
      fields?: Record<string, string>;
      /** ต้องยืนยันการเปลี่ยนอีเมลก่อน (spec 4.3) */
      confirmEmail?: { from: string | null; to: string };
    }
  | undefined;

function parse(form: FormData) {
  return staffSchema.safeParse({
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    position: String(form.get("position") ?? ""),
    branch: String(form.get("branch") ?? ""),
    job: String(form.get("job") ?? ""),
  });
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function createStaffAction(_prev: StaffFormState, form: FormData): Promise<StaffFormState> {
  const actor = await requireCentral();
  const parsed = parse(form);
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const r = await createStaff(actor, parsed.data);
  if (!r.ok) return "confirmEmail" in r ? undefined : r.field ? { fields: { [r.field]: r.error } } : { error: r.error };
  revalidatePath("/", "layout");
  // ไปตั้งสิทธิ์ต่อที่หน้ารายคน (spec 4.2 สิทธิ์ไม่บังคับตอนเพิ่ม)
  redirect(`/u/${r.id}?created=1`);
}

export async function editStaffAction(userId: number, _prev: StaffFormState, form: FormData): Promise<StaffFormState> {
  const actor = await requireCentral();
  const parsed = parse(form);
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const r = await editStaff(actor, userId, parsed.data, form.get("confirmEmail") === "yes");
  if (!r.ok) {
    if ("confirmEmail" in r) return { confirmEmail: { from: r.from, to: r.to } };
    return r.field ? { fields: { [r.field]: r.error } } : { error: r.error };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

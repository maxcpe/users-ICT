// กติกาเพิ่ม/แก้ข้อมูลบุคลากร (spec 4.2, 4.3, 8) — ไม่แตะฐานข้อมูล ทดสอบได้

import { z } from "zod";
import { ALLOWED_EMAIL_DOMAIN } from "./login-rules";
import { hasFourByteChars, isStudentPosition, normalizeEmail } from "./text";

export const SUPPORT_BRANCH = "สำนักงานคณะ";

export type StaffFields = {
  name: string;
  email: string;
  position: string;
  branch: string;
  job: string | null;
};

const text = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, `กรอก${label}`)
    .max(max, `${label}ยาวเกิน ${max} ตัวอักษร`)
    .refine((v) => !hasFourByteChars(v), `${label}มีอีโมจิหรืออักขระพิเศษที่บันทึกไม่ได้`);

export const staffSchema = z
  .object({
    name: text("ชื่อ–สกุล"),
    email: z
      .string()
      .transform(normalizeEmail)
      .pipe(
        z
          .string()
          .min(1, "กรอกอีเมล")
          .max(255)
          .regex(/^[a-z0-9._%+-]+@up\.ac\.th$/, `อีเมลต้องเป็นบัญชี ${ALLOWED_EMAIL_DOMAIN} และตรงกับบัญชี Microsoft 365`),
      ),
    position: text("ตำแหน่ง").refine((v) => !isStudentPosition(v), "ระบบนี้จัดการเฉพาะบุคลากร ตำแหน่งขึ้นต้นด้วย \"นักศึกษา\" ไม่ได้"),
    branch: text("สังกัด"),
    job: z
      .string()
      .trim()
      .max(255)
      .refine((v) => !hasFourByteChars(v), "งานมีอีโมจิหรืออักขระพิเศษที่บันทึกไม่ได้")
      .transform((v) => (v === "" || v === "-" ? null : v)),
  })
  .superRefine((v, ctx) => {
    // สายสนับสนุนต้องมีงาน (ระบบประเมินใช้แยกงาน) สายวิชาการไม่มีงาน
    if (v.branch === SUPPORT_BRANCH && !v.job) ctx.addIssue({ code: "custom", path: ["job"], message: "สายสนับสนุนต้องระบุงาน" });
  });

export type StaffInput = z.infer<typeof staffSchema>;

/** ช่องที่เปลี่ยน { field: [เดิม, ใหม่] } เทียบแบบเดียวกับที่บันทึก (อีเมลตัดช่องว่าง ตัวพิมพ์เล็ก) */
export function diffStaff(before: Partial<Record<keyof StaffFields, string | null>>, after: StaffInput) {
  const norm = (k: keyof StaffFields, v: string | null | undefined) => {
    if (v === null || v === undefined) return null;
    if (k === "email") return normalizeEmail(v);
    const t = v.trim();
    return k === "job" && (t === "" || t === "-") ? null : t;
  };
  const out: Partial<Record<keyof StaffFields, [string | null, string | null]>> = {};
  for (const k of ["name", "email", "position", "branch", "job"] as const) {
    const a = norm(k, before[k]);
    const b = after[k] ?? null;
    if (a !== b) out[k] = [before[k] ?? null, b];
  }
  return out;
}

export const STAFF_FIELD_LABEL: Record<keyof StaffFields, string> = {
  name: "ชื่อ–สกุล",
  email: "อีเมล",
  position: "ตำแหน่ง",
  branch: "สังกัด",
  job: "งาน",
};

export const STAFF_COLUMN: Record<keyof StaffFields, "U_name" | "U_email" | "U_position" | "U_branch" | "U_job"> = {
  name: "U_name",
  email: "U_email",
  position: "U_position",
  branch: "U_branch",
  job: "U_job",
};

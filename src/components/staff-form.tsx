"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { StaffFormState } from "@/app/(app)/u/staff-actions";
import { FieldError, FormMessage, SubmitButton } from "./form-bits";

type Values = { name: string; email: string; position: string; branch: string; job: string };

const SUPPORT_BRANCH = "สำนักงานคณะ";

/** ฟอร์มข้อมูลทั่วไป ใช้ทั้งเพิ่มและแก้ (spec 4.2, 4.3) */
export function StaffForm({
  action,
  initial,
  branches,
  jobs,
  submitLabel,
  cancelHref,
  isEdit,
}: {
  action: (prev: StaffFormState, form: FormData) => Promise<StaffFormState>;
  initial: Values;
  branches: string[];
  jobs: string[];
  submitLabel: string;
  cancelHref: string;
  isEdit: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [branch, setBranch] = useState(initial.branch);
  const f = state?.fields;
  const support = branch.trim() === SUPPORT_BRANCH;

  const field = (
    name: keyof Values,
    label: string,
    opts: { required?: boolean; hint?: string; list?: string; type?: string; autoComplete?: string } = {},
  ) => (
    <div className="field">
      <label htmlFor={`f-${name}`}>
        {label} {opts.required && <span className="req">*</span>}
      </label>
      <input
        id={`f-${name}`}
        name={name}
        type={opts.type ?? "text"}
        className="input"
        defaultValue={initial[name]}
        required={opts.required}
        list={opts.list}
        autoComplete={opts.autoComplete ?? "off"}
        maxLength={255}
        aria-invalid={f?.[name] ? true : undefined}
        aria-describedby={[opts.hint ? `f-${name}-hint` : "", f?.[name] ? `f-${name}-err` : ""].filter(Boolean).join(" ") || undefined}
        onChange={name === "branch" ? (e) => setBranch(e.target.value) : undefined}
      />
      {opts.hint && <span id={`f-${name}-hint`} className="hint">{opts.hint}</span>}
      <FieldError id={`f-${name}-err`} message={f?.[name]} />
    </div>
  );

  return (
    <form action={formAction} className="glass pad">
      <FormMessage state={state} />
      {field("email", "อีเมล", { required: true, type: "email", hint: "ต้องตรงกับบัญชี Microsoft 365 (@up.ac.th) ระบบตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็กให้" })}
      {field("name", "ชื่อ–สกุล", { required: true, hint: "รวมคำนำหน้าและตำแหน่งทางวิชาการ เช่น ผู้ช่วยศาสตราจารย์ ดร.สมมติ ใจดี" })}
      <div className="grid gap-x-3.5 min-[700px]:grid-cols-2">
        {field("position", "ตำแหน่ง", { required: true, hint: "ห้ามขึ้นต้นด้วย \"นักศึกษา\"" })}
        {field("branch", "สังกัด", { required: true, list: "branch-list", hint: "สายสนับสนุนใช้ \"สำนักงานคณะ\" ให้ตรงทุกตัวอักษร สายวิชาการใช้ชื่อหลักสูตร" })}
      </div>
      {field("job", "งาน", {
        required: support,
        list: "job-list",
        hint: support ? "สายสนับสนุนต้องระบุงาน" : "สายวิชาการเว้นว่างได้",
      })}
      <datalist id="branch-list">{branches.map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id="job-list">{jobs.map((j) => <option key={j} value={j} />)}</datalist>

      {state?.confirmEmail && (
        <div className="callout callout-warn mb-4" role="alert">
          <span aria-hidden="true">⚠</span>
          <div className="grid gap-2">
            <span>
              เปลี่ยนอีเมลจาก <b>{state.confirmEmail.from ?? "ไม่มี"}</b> เป็น <b>{state.confirmEmail.to}</b>
              <br />
              เว็บที่จับคู่ด้วยอีเมลจะเห็นเป็นบัญชีเดิมได้ก็ต่อเมื่ออีเมลใหม่ตรงกับบัญชี 365 ของคนนี้ ตรวจให้แน่ใจก่อนยืนยัน
            </span>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="confirmEmail" value="yes" className="check" required />
              ยืนยันว่าอีเมลใหม่ถูกต้อง
            </label>
          </div>
        </div>
      )}

      {isEdit && (
        <p className="small mt-0">ระบบประเมินเก็บชื่อและตำแหน่ง ณ วันปิดรอบ การแก้ที่นี่ไม่เปลี่ยนรายงานเก่า</p>
      )}
      <div className="flex flex-wrap justify-end gap-2.5">
        <Link href={cancelHref} className="btn">ยกเลิก</Link>
        <SubmitButton>{state?.confirmEmail ? "ยืนยันและบันทึก" : submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

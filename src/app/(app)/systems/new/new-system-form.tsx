"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-bits";
import { LevelEditor } from "@/components/level-editor";
import { SystemInfoFields } from "@/components/system-info-fields";
import { createSystem, type FormState } from "../actions";
import { IconInfo } from "@/components/icons";

export function NewSystemForm() {
  const [state, action] = useActionState<FormState, FormData>(createSystem, undefined);
  const f = state?.fields;
  return (
    <form action={action} className="glass pad">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="key">key <span className="req">*</span></label>
        <input
          id="key"
          name="key"
          className="input mono"
          required
          pattern="[a-z][a-z0-9_]{1,49}"
          placeholder="เช่น library"
          autoComplete="off"
          aria-invalid={f?.key ? true : undefined}
          aria-describedby="key-hint key-err"
        />
        <span id="key-hint" className="hint">
          a–z ตัวเลข และ _ · เว็บใช้ key นี้ในโค้ด <b className="text-warn-ink">เปลี่ยนภายหลังได้แต่เว็บต้องแก้ตาม</b>
        </span>
        <FieldError id="key-err" message={f?.key} />
      </div>

      <SystemInfoFields defaults={{ name: "", icon: null, url: null, note: null }} fields={f} />

      <h2 className="h2 mt-2">ระดับสิทธิ์</h2>
      <LevelEditor initial={[{ value: 1, label: "ผู้ใช้งาน" }, { value: 99, label: "ผู้ดูแล" }]} />
      <FieldError id="levels-err" message={f?.levels} />

      <div className="callout callout-info my-4">
        <IconInfo />
        <span>
          ระบบใหม่เก็บสิทธิ์ในตารางกลาง ใช้ได้ทันทีโดยไม่ต้องแก้ตาราง หลังบันทึกจะไปที่หน้า <b>วิธีเชื่อมต่อ</b> เพื่อดู SQL ให้นักพัฒนาของเว็บนี้
        </span>
      </div>
      <div className="flex flex-wrap justify-end gap-2.5">
        <Link href="/systems" className="btn">ยกเลิก</Link>
        <SubmitButton>ลงทะเบียนระบบ</SubmitButton>
      </div>
    </form>
  );
}

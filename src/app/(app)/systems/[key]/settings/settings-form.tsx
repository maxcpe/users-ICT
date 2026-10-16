"use client";

import { useActionState } from "react";
import { CopyButton } from "@/components/copy-button";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { RenameKeyButton } from "@/components/rename-key-button";
import { SystemInfoFields } from "@/components/system-info-fields";
import type { SystemDef } from "@/lib/registry";
import { saveSettings, type FormState } from "../../actions";

export function SettingsForm({ system, locked }: { system: SystemDef; locked: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(saveSettings.bind(null, system.key), undefined);
  return (
    <form action={action} className="glass pad">
      <h2 className="h2">ข้อมูลระบบ</h2>
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="key">key</label>
        <div className="flex flex-wrap items-center gap-2.5">
          <input id="key" className="input mono flex-1" value={system.key} readOnly aria-describedby="key-hint" />
          <CopyButton text={system.key} />
          {!locked && <RenameKeyButton systemKey={system.key} />}
        </div>
        <span id="key-hint" className="hint">เว็บอื่นใช้ key นี้อ่านสิทธิ์จาก v_roles (แท็บวิธีเชื่อมต่อ) เปลี่ยนได้แต่เว็บที่ใช้ key เดิมต้องแก้ตาม</span>
      </div>
      <SystemInfoFields defaults={system} fields={state?.fields} />
      {!locked && (
        <label className="mb-4 flex min-h-11 items-center gap-3">
          <input type="checkbox" name="active" className="check" defaultChecked={system.active} />
          <span>
            แสดงในหน้าจอ
            <span className="hint block">ปิดเมื่อเลิกใช้ระบบนี้ ซ่อนจากหน้าจอ แต่การปิดใช้งานผู้ใช้ยังล้างสิทธิ์ของระบบนี้</span>
          </span>
        </label>
      )}
      <div className="flex justify-end">
        <SubmitButton>บันทึก</SubmitButton>
      </div>
    </form>
  );
}

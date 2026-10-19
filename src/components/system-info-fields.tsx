"use client";

import { useState } from "react";
import { FieldError } from "./form-bits";
import { DEFAULT_SYSTEM_ICON, isSystemIconKey, SYSTEM_ICONS } from "@/lib/system-icons";
import { SystemIcon } from "./system-icon";


/** ช่องข้อมูลระบบที่ใช้ทั้งหน้าลงทะเบียนและหน้าตั้งค่า */
export function SystemInfoFields({
  defaults,
  fields,
}: {
  defaults: { name: string; icon: string | null; url: string | null; note: string | null };
  fields?: Record<string, string>;
}) {
  const [icon, setIcon] = useState<string>(isSystemIconKey(defaults.icon) ? defaults.icon : DEFAULT_SYSTEM_ICON);
  const err = (k: string) => fields?.[k];
  return (
    <>
      <div className="field">
        <label htmlFor="name">ชื่อที่แสดง <span className="req">*</span></label>
        <input
          id="name"
          name="name"
          className="input"
          defaultValue={defaults.name}
          required
          maxLength={100}
          aria-invalid={err("name") ? true : undefined}
          aria-describedby={err("name") ? "name-err" : undefined}
        />
        <FieldError id="name-err" message={err("name")} />
      </div>
      <fieldset className="field border-0 p-0">
        <legend className="label mb-1.5">ไอคอน</legend>
        <input type="hidden" name="icon" value={icon} />
        <div className="chips">
          {SYSTEM_ICONS.map((i) => (
            <button
              key={i.key}
              type="button"
              className="pill !min-w-11 justify-center !px-0 text-lg"
              aria-pressed={icon === i.key}
              aria-label={`ไอคอน ${i.label}`}
              title={i.label}
              onClick={() => setIcon(i.key)}
            >
              <SystemIcon name={i.key} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="url">ลิงก์ไปยังระบบ</label>
        <input
          id="url"
          name="url"
          className="input"
          defaultValue={defaults.url ?? ""}
          placeholder="https://service.ict.up.ac.th/…"
          aria-invalid={err("url") ? true : undefined}
          aria-describedby={err("url") ? "url-err" : undefined}
        />
        <FieldError id="url-err" message={err("url")} />
      </div>
      <div className="field">
        <label htmlFor="note">หมายเหตุบนหน้าจอ</label>
        <input id="note" name="note" className="input" defaultValue={defaults.note ?? ""} maxLength={255} placeholder="เช่น มีผลเมื่อเข้าสู่ระบบครั้งถัดไป" aria-describedby="note-hint" />
        <span id="note-hint" className="hint">แสดงใต้ชื่อระบบในหน้าสิทธิ์รายคน</span>
      </div>
    </>
  );
}

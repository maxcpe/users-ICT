"use client";

import { useState, useTransition } from "react";
import { renameKeyAction } from "@/app/(app)/u/lifecycle-actions";
import { ConfirmDialog } from "./confirm-dialog";

const KEY_RE = /^[a-z][a-z0-9_]{1,49}$/;

/** เปลี่ยน key ของระบบ — เตือนว่าเว็บที่อ่านด้วย key เดิมต้องแก้โค้ดตาม */
export function RenameKeyButton({ systemKey }: { systemKey: string }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const valid = KEY_RE.test(next) && next !== systemKey && next !== "users";

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={() => { setNext(""); setError(null); setOpen(true); }}>
        เปลี่ยน key…
      </button>
      <ConfirmDialog
        open={open}
        tone="danger"
        title={`เปลี่ยน key ของระบบ ${systemKey}`}
        description="เว็บที่อ่านสิทธิ์ด้วย key เดิม (WHERE system_key = '…') ต้องแก้โค้ดเป็น key ใหม่พร้อมกัน ไม่งั้นผู้ใช้ทุกคนของเว็บนั้นจะเข้าไม่ได้"
        impacts={[
          { label: "ทะเบียนระบบ ผู้ดูแล และสิทธิ์ใน user_roles", value: "ย้ายไป key ใหม่", tone: "count" },
          { label: "บันทึกการใช้งานเก่า", value: "คง key เดิม", tone: "muted" },
          { label: "view v_roles ที่เว็บอื่นอ่าน", value: "ใช้ key ใหม่ทันที", tone: "now" },
        ]}
        confirmLabel="เปลี่ยน key"
        busy={busy}
        confirmDisabled={!valid}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            setError(null);
            const r = await renameKeyAction(systemKey, next);
            if (!r.ok) setError(r.error);
          })
        }
      >
        <div className="field">
          <label htmlFor="new-key">key ใหม่</label>
          <input
            id="new-key"
            className="input mono"
            autoComplete="off"
            value={next}
            onChange={(e) => setNext(e.target.value.toLowerCase())}
            // dialog อยู่ในฟอร์มตั้งค่า กด Enter ห้ามไปส่งฟอร์มนั้น
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            aria-describedby="new-key-hint"
            aria-invalid={next !== "" && !valid ? true : undefined}
          />
          <span id="new-key-hint" className="hint">a–z ตัวเลข และ _ ขึ้นต้นด้วยตัวอักษร ยาว 2–50 ตัว</span>
        </div>
      </ConfirmDialog>
    </>
  );
}

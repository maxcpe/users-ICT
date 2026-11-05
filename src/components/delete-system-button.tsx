"use client";

import { useState, useTransition } from "react";
import { deleteSystemAction } from "@/app/(app)/u/lifecycle-actions";
import { ConfirmDialog } from "./confirm-dialog";

/** ลบระบบออกจากทะเบียน (spec 4.6.3) ต้องพิมพ์ key ยืนยัน */
export function DeleteSystemButton({
  systemKey,
  systemName,
  storage,
  holders,
  admins,
  disabledReason,
}: {
  systemKey: string;
  systemName: string;
  storage: "column" | "table";
  holders: number;
  admins: number;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <>
      <button
        type="button"
        className="btn btn-danger"
        disabled={!!disabledReason}
        onClick={() => { setText(""); setError(null); setOpen(true); }}
      >
        ลบระบบ…
      </button>
      {disabledReason && <p className="small mb-0 mt-2">{disabledReason}</p>}

      <ConfirmDialog
        open={open}
        tone="danger"
        title={`ลบ${systemName}ออกจากทะเบียน?`}
        description={
          storage === "column"
            ? "เว็บนี้อ่านสิทธิ์จากคอลัมน์เดิมในตาราง user คอลัมน์ยังอยู่แต่ทุกคนจะเป็น \"ไม่มีสิทธิ์\" ทันที และเพิ่มระบบนี้กลับจากหน้าเว็บไม่ได้ (ต้องให้ผู้พัฒนาเพิ่ม)"
            : "เว็บที่อ่านสิทธิ์ด้วย key นี้จะไม่พบสิทธิ์ของใครอีก ข้อมูลระบบและค่าเดิมของทุกคนถูกเก็บในบันทึกการใช้งาน แต่ไม่มีปุ่มคืนอัตโนมัติ"
        }
        impacts={[
          { label: "ทุกคนเป็น \"ไม่มีสิทธิ์\"", value: `${holders} คน`, tone: "now" },
          { label: "ถอนผู้ดูแลระบบนี้", value: `${admins} คน`, tone: "now" },
          { label: "ระบบหายจากทะเบียนและหน้าจอ", value: "ทันที", tone: "now" },
          { label: "บันทึกการใช้งานเก่า", value: "เก็บไว้", tone: "muted" },
        ]}
        confirmLabel="ลบระบบ"
        busy={busy}
        confirmDisabled={text.trim() !== systemKey}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            setError(null);
            // สำเร็จแล้ว action จะพาไปหน้ารายการระบบเอง
            const r = await deleteSystemAction(systemKey, text);
            if (r && !r.ok) setError(r.error);
          })
        }
      >
        <div className="field">
          <label htmlFor="delete-system-key">พิมพ์ <b className="mono text-white">{systemKey}</b> เพื่อยืนยัน</label>
          <input id="delete-system-key" className="input mono" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </ConfirmDialog>
    </>
  );
}

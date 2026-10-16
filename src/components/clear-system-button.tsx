"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearSystemAction } from "@/app/(app)/u/lifecycle-actions";
import { ConfirmDialog } from "./confirm-dialog";

/** ล้างสิทธิ์ทั้งระบบ (spec 4.6.1) ต้องพิมพ์ key ยืนยัน */
export function ClearSystemButton({
  systemKey,
  systemName,
  holders,
  admins,
  disabledReason,
}: {
  systemKey: string;
  systemName: string;
  holders: number;
  admins: number;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <>
      <button
        type="button"
        className="btn btn-danger"
        disabled={!!disabledReason || holders + admins === 0}
        onClick={() => { setText(""); setError(null); setOpen(true); }}
      >
        ล้างสิทธิ์ {holders} คน…
      </button>
      {disabledReason && <p className="small mb-0 mt-2">{disabledReason}</p>}
      <p aria-live="polite" className="small mb-0 mt-2">{message}</p>

      <ConfirmDialog
        open={open}
        tone="danger"
        title={`ล้างสิทธิ์ทั้ง${systemName}?`}
        description="ใช้เมื่อปิดระบบถาวร ค่าเดิมของทุกคนถูกเก็บในบันทึกการใช้งาน แต่ไม่มีปุ่มคืนค่าอัตโนมัติ"
        impacts={[
          { label: "ทุกคนเป็น \"ไม่มีสิทธิ์\"", value: `${holders} คน`, tone: "now" },
          { label: "ถอนผู้ดูแลระบบนี้", value: `${admins} คน`, tone: "now" },
        ]}
        confirmLabel="ล้างสิทธิ์"
        busy={busy}
        confirmDisabled={text.trim() !== systemKey}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            setError(null);
            const r = await clearSystemAction(systemKey, text);
            if (!r.ok) return setError(r.error);
            setOpen(false);
            setMessage(r.message);
            router.refresh();
          })
        }
      >
        <div className="field">
          <label htmlFor="clear-key">พิมพ์ <b className="mono text-white">{systemKey}</b> เพื่อยืนยัน</label>
          <input id="clear-key" className="input mono" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </ConfirmDialog>
    </>
  );
}

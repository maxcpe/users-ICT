"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revealAction, updateSensitiveAction } from "@/app/(app)/u/lifecycle-actions";

type Field = "rfid" | "tel";

/** RFID / เบอร์โทร: แสดงแบบปิดบางส่วน กด "แสดง" แล้วบันทึกลง audit log (spec 6.2) */
export function SensitivePanel({
  userId,
  masked,
  readOnly,
}: {
  userId: number;
  masked: Record<Field, string | null>;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [shown, setShown] = useState<Partial<Record<Field, string | null>>>({});
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const rows: { f: Field; label: string; hint?: string }[] = [
    { f: "rfid", label: "รหัสบัตร RFID", hint: "ต้องไม่ซ้ำกับคนอื่น" },
    { f: "tel", label: "เบอร์โทร", hint: "ระบบจองห้องประชุมใช้ในฟอร์มจอง" },
  ];

  return (
    <div className="glass">
      {error && (
        <div className="callout callout-bad m-4" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      )}
      {rows.map(({ f, label, hint }) => (
        <div key={f} className="flex flex-wrap items-center gap-3 border-[var(--line-2)] p-4 [&+&]:border-t">
          <div className="min-w-[200px] flex-1">
            <b>{label}</b>
            {hint && <div className="small">{hint}</div>}
          </div>
          {editing === f ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  setError(null);
                  const r = await updateSensitiveAction(userId, f, draft);
                  if (!r.ok) return setError(r.error);
                  setEditing(null);
                  setShown((s) => ({ ...s, [f]: undefined }));
                  setDraft("");
                  router.refresh();
                });
              }}
            >
              <label htmlFor={`s-${f}`} className="sr-only">{label}ใหม่</label>
              <input id={`s-${f}`} className="input mono !w-56" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="เว้นว่าง = ล้างค่า" autoFocus />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>บันทึก</button>
              <button type="button" className="btn btn-sm" onClick={() => { setEditing(null); setDraft(""); }}>ยกเลิก</button>
            </form>
          ) : (
            <>
              <span className="mono text-white" aria-live="polite">
                {shown[f] !== undefined ? (shown[f] ?? "ยังไม่มี") : (masked[f] ?? <span className="small">ยังไม่มี</span>)}
              </span>
              {masked[f] && shown[f] === undefined && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const r = await revealAction(userId, f);
                      if (!r.ok) return setError(r.error);
                      setShown((s) => ({ ...s, [f]: r.value }));
                    })
                  }
                >
                  👁 แสดง
                </button>
              )}
              {!readOnly && (
                <button type="button" className="btn btn-sm" onClick={() => { setError(null); setDraft(""); setEditing(f); }}>
                  แก้ไข
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

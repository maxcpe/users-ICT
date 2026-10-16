"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setMultiRolesAction } from "@/app/(app)/u/lifecycle-actions";
import { ConfirmDialog, type Impact } from "./confirm-dialog";

/** สวิตช์ "หลายสิทธิ์ต่อคน" ในแท็บตั้งค่า (spec 2.3) ต้องพิมพ์ key ยืนยัน */
export function MultiRolesSwitch({
  systemKey,
  systemName,
  multi,
  columnName,
  holders,
  multiHolders,
  disabledReason,
}: {
  systemKey: string;
  systemName: string;
  multi: boolean;
  /** ระบบแบบ column ที่จะถูกย้าย (null = เก็บในตารางกลางอยู่แล้ว) */
  columnName: string | null;
  holders: number;
  /** จำนวนคนที่ถือมากกว่า 1 บทบาท (ปิดได้เมื่อเป็น 0) */
  multiHolders: number;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const enable = !multi;
  const blocked = disabledReason ?? (!enable && multiHolders > 0 ? `ปิดไม่ได้: มี ${multiHolders} คนถือมากกว่า 1 บทบาท` : undefined);

  const impacts: Impact[] = enable
    ? [
        { label: "ติ๊กได้หลายบทบาทต่อคน", value: "ทันที", tone: "count" },
        ...(columnName
          ? ([
              { label: `ย้ายสิทธิ์ปัจจุบันไปตารางกลาง (user_roles)`, value: `${holders} คน`, tone: "count" },
              { label: `ล้างคอลัมน์ ${columnName} — เว็บที่ยังอ่านคอลัมน์นี้จะเข้าไม่ได้ทุกคน`, value: "ทันที", tone: "now" },
            ] satisfies Impact[])
          : []),
        { label: `เว็บ${systemName}ต้องอ่าน v_roles (1 แถวต่อบทบาท)`, value: "ก่อนเปิด", tone: "later" },
      ]
    : [
        { label: "กลับเป็นคนละ 1 ระดับ", value: "ทันที", tone: "count" },
        { label: "ยังเก็บในตารางกลาง ไม่ย้ายกลับคอลัมน์เดิม", value: "คงเดิม", tone: "muted" },
      ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`chip ${multi ? "chip-ok" : "chip-off"}`}>{multi ? "● เปิดอยู่" : "ปิดอยู่"}</span>
        <button
          type="button"
          className={enable ? "btn" : "btn btn-danger"}
          disabled={!!blocked}
          onClick={() => { setText(""); setError(null); setOpen(true); }}
        >
          {enable ? "เปิดหลายสิทธิ์ต่อคน…" : "ปิดหลายสิทธิ์ต่อคน…"}
        </button>
      </div>
      {blocked && <p className="small mb-0 mt-2">{blocked}</p>}
      <p aria-live="polite" className="small mb-0 mt-2">{message}</p>

      <ConfirmDialog
        open={open}
        tone={enable && columnName ? "danger" : "pink"}
        title={`${enable ? "เปิด" : "ปิด"}หลายสิทธิ์ต่อคนใน${systemName}?`}
        description={
          enable && columnName
            ? `แก้เว็บ${systemName}ให้อ่าน v_roles ให้เสร็จก่อน ค่าเดิมของทุกคนเก็บไว้ในบันทึกการใช้งาน`
            : undefined
        }
        impacts={impacts}
        confirmLabel={enable ? "เปิด" : "ปิด"}
        busy={busy}
        confirmDisabled={text.trim() !== systemKey}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            setError(null);
            const r = await setMultiRolesAction(systemKey, enable, text);
            if (!r.ok) return setError(r.error);
            setOpen(false);
            setMessage(r.message);
            router.refresh();
          })
        }
      >
        <div className="field">
          <label htmlFor="multi-key">
            พิมพ์ <b className="mono text-white">{systemKey}</b> เพื่อยืนยัน
          </label>
          <input id="multi-key" className="input mono" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        </div>
      </ConfirmDialog>
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { IconAlert } from "@/components/icons";

export type Impact = { label: string; value: string; tone?: "now" | "later" | "count" | "muted" };

const toneColor: Record<NonNullable<Impact["tone"]>, string> = {
  now: "var(--bad-ink)",
  later: "var(--warn-ink)",
  count: "var(--cyan-ink)",
  muted: "var(--faint)",
};

/**
 * dialog ยืนยัน (design.md 5.10) ใช้ <dialog> ของเบราว์เซอร์: focus trap, Esc ปิด, คืน focus ให้ปุ่มที่เปิด
 */
export function ConfirmDialog({
  open,
  title,
  description,
  impacts = [],
  confirmLabel,
  tone = "pink",
  busy = false,
  confirmDisabled = false,
  error,
  children,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  impacts?: Impact[];
  confirmLabel: string;
  tone?: "pink" | "cyan" | "danger";
  busy?: boolean;
  /** ปิดเฉพาะปุ่มยืนยัน (เช่น ยังพิมพ์ยืนยันไม่ตรง) ปุ่มยกเลิกและ Esc ยังใช้ได้ */
  confirmDisabled?: boolean;
  error?: string | null;
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  const border = tone === "cyan" ? "#00e1ff55" : tone === "danger" ? "#ff4d6d66" : "#ff2bd655";
  const glow = "var(--shadow-float)";
  const btn = tone === "cyan" ? "btn btn-cyan" : tone === "danger" ? "btn text-white" : "btn btn-primary";

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[min(520px,calc(100%-32px))] rounded-[22px] p-6 text-ink backdrop:bg-[#05030ccc] backdrop:backdrop-blur-sm"
      style={{ background: "var(--surface)", border: `1px solid ${border}`, boxShadow: glow }}
    >
      <h2 id="confirm-title" className="h2 !text-[22px]">{title}</h2>
      {description && <div className="mb-0 mt-0 text-muted">{description}</div>}
      {impacts.length > 0 && (
        <ul className="my-3 grid list-none gap-1.5 p-0 text-sm">
          {impacts.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 rounded-[10px] px-3 py-2" style={{ background: "var(--glass)" }}>
              <span>{i.label}</span>
              <b style={{ color: toneColor[i.tone ?? "count"] }}>{i.value}</b>
            </li>
          ))}
        </ul>
      )}
      {children}
      {error && (
        <div className="callout callout-bad mt-3" role="alert">
          <IconAlert />
          <span>{error}</span>
        </div>
      )}
      <div className="mt-[18px] flex flex-wrap justify-end gap-2.5">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button
          type="button"
          className={btn}
          style={tone === "danger" ? { background: "var(--bad-strong)", border: 0 } : undefined}
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
          aria-disabled={busy || confirmDisabled}
        >
          {busy ? "กำลังบันทึก…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

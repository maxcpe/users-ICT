"use client";

import { useFormStatus } from "react-dom";
import { IconAlert, IconCheck } from "@/components/icons";

export function SubmitButton({ children, className = "btn btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? "กำลังบันทึก…" : children}
    </button>
  );
}

/** ข้อความผลการบันทึก ประกาศผ่าน aria-live (design.md 9) */
export function FormMessage({ state }: { state: { ok?: boolean; error?: string } | undefined }) {
  return (
    <div aria-live="polite">
      {state?.error && (
        <div className="callout callout-bad mb-4" role="alert">
          <IconAlert />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="callout callout-info mb-4">
          <IconCheck />
          <span>บันทึกแล้ว</span>
        </div>
      )}
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="hint" style={{ color: "var(--bad-ink)" }}>
      {message}
    </span>
  );
}

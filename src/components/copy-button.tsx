"use client";

import { useState } from "react";

export function CopyButton({ text, label = "คัดลอก" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  return (
    <button
      type="button"
      className="btn btn-sm btn-cyan"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
    >
      <span aria-live="polite">{state === "done" ? "คัดลอกแล้ว" : state === "failed" ? "คัดลอกไม่ได้ ให้เลือกข้อความเอง" : label}</span>
    </button>
  );
}

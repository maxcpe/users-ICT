"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deactivateAction, deleteAction, reactivateAction } from "@/app/(app)/u/lifecycle-actions";
import { DEACTIVATE_REASONS } from "@/lib/lifecycle-rules";
import { ConfirmDialog, type Impact } from "./confirm-dialog";

type RoleLine = { key: string; name: string; label: string; note: string | null };

/** ปุ่มปิด/เปิดใช้งาน และลบ บนหน้ารายคน (spec 4.5, 4.5.1) — ผู้ดูแลกลางเท่านั้น */
export function PersonActions({
  userId,
  name,
  email,
  status,
  scheduledDate,
  today,
  roles,
  saved,
  deleteBlockers,
  isSelf,
}: {
  userId: number;
  name: string;
  email: string | null;
  status: "active" | "inactive" | "scheduled";
  scheduledDate: string | null;
  today: string;
  /** สิทธิ์ปัจจุบัน (ใช้แสดงผลกระทบตอนปิดใช้งาน) */
  roles: RoleLine[];
  /** สิทธิ์ที่เก็บไว้ตอนปิดใช้งาน (ใช้ตอนเปิดใช้งานอีกครั้ง) */
  saved: RoleLine[];
  deleteBlockers: string[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"deactivate" | "reactivate" | "delete" | null>(null);
  const [reason, setReason] = useState<string>(DEACTIVATE_REASONS[0]);
  const [date, setDate] = useState(today);
  const [restore, setRestore] = useState<Set<string>>(() => new Set(saved.map((s) => s.key)));
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const confirmTarget = email ?? String(userId);
  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      setOpen(null);
      setMessage(r.message);
      router.refresh();
    });

  const deactivateImpacts: Impact[] =
    roles.length === 0
      ? [{ label: "ยังไม่มีสิทธิ์ในระบบใด", value: "", tone: "muted" }]
      : roles.map((r) => ({ label: `${r.name} · ${r.label}`, value: r.note ?? "ถูกล้าง", tone: r.note?.includes("ทันที") ? "now" : "later" }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span aria-live="polite" className="small">{message}</span>
      {status === "active" && (
        <button type="button" className="btn btn-danger" disabled={isSelf} title={isSelf ? "ปิดใช้งานตัวเองไม่ได้" : undefined} onClick={() => { setError(null); setOpen("deactivate"); }}>
          ปิดใช้งาน
        </button>
      )}
      {status === "scheduled" && (
        <button type="button" className="btn" onClick={() => run(() => reactivateAction(userId, []))} disabled={busy}>
          ยกเลิกการปิดวันที่ {scheduledDate}
        </button>
      )}
      {status === "inactive" && (
        <button type="button" className="btn btn-primary" onClick={() => { setError(null); setOpen("reactivate"); }}>
          เปิดใช้งานอีกครั้ง
        </button>
      )}
      {!isSelf && (
        <button type="button" className="btn btn-sm" onClick={() => { setError(null); setConfirmText(""); setOpen("delete"); }}>
          ลบ…
        </button>
      )}

      <ConfirmDialog
        open={open === "deactivate"}
        tone="danger"
        title={`ปิดใช้งาน ${name}?`}
        description="ระบบจะล้างสิทธิ์ทุกระบบและถอนจากผู้ดูแล เก็บค่าเดิมไว้ให้คืนได้ภายหลัง ไม่ลบข้อมูล"
        impacts={date > today ? [{ label: "ตั้งปิดล่วงหน้า สิทธิ์ยังใช้ได้จนถึงวันนั้น", value: date, tone: "later" }] : deactivateImpacts}
        confirmLabel={date > today ? "ตั้งปิดล่วงหน้า" : "ปิดใช้งาน"}
        busy={busy}
        error={error}
        onClose={() => setOpen(null)}
        onConfirm={() => run(() => deactivateAction(userId, reason, date))}
      >
        <div className="field">
          <label htmlFor="d-reason">เหตุผล <span className="req">*</span></label>
          <select id="d-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {DEACTIVATE_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="d-date">วันที่มีผล</label>
          <input id="d-date" type="date" className="input" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-describedby="d-date-hint" />
          <span id="d-date-hint" className="hint">วันนี้ = ปิดทันที · วันหลังจากนี้ = ระบบปิดให้เองเมื่อถึงวัน</span>
        </div>
        <p className="small m-0">รถตู้ จองห้องประชุม และห้องศึกษายังเข้าฝั่งผู้ใช้ได้จนกว่าบัญชี 365 จะถูกปิด (spec 4.5)</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "reactivate"}
        title={`เปิดใช้งาน ${name} อีกครั้ง`}
        description="เลือกสิทธิ์เดิมที่จะคืน ไม่เลือกเลย = เริ่มใหม่โดยไม่มีสิทธิ์ ส่วนการเป็นผู้ดูแลต้องแต่งตั้งใหม่"
        confirmLabel={restore.size ? `เปิดใช้งานและคืน ${restore.size} ระบบ` : "เปิดใช้งาน"}
        busy={busy}
        error={error}
        onClose={() => setOpen(null)}
        onConfirm={() => run(() => reactivateAction(userId, [...restore]))}
      >
        {saved.length === 0 ? (
          <p className="small">ไม่มีสิทธิ์เดิมที่เก็บไว้</p>
        ) : (
          <fieldset className="m-0 mt-2 grid gap-1 border-0 p-0">
            <legend className="label mb-1">สิทธิ์เดิม</legend>
            {saved.map((s) => (
              <label key={s.key} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="check"
                  checked={restore.has(s.key)}
                  onChange={(e) =>
                    setRestore((r) => {
                      const n = new Set(r);
                      if (e.target.checked) n.add(s.key);
                      else n.delete(s.key);
                      return n;
                    })
                  }
                />
                <span>{s.name} · {s.label}</span>
              </label>
            ))}
          </fieldset>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "delete"}
        tone="danger"
        title={`ลบ ${name} ถาวร?`}
        description={
          deleteBlockers.length
            ? "ลบไม่ได้ ใช้ \"ปิดใช้งาน\" แทน"
            : "ใช้กับแถวที่เพิ่มผิดหรือซ้ำเท่านั้น ลบแล้วกู้คืนไม่ได้ ข้อมูลเดิมถูกเก็บในบันทึกการใช้งาน"
        }
        impacts={
          deleteBlockers.length
            ? deleteBlockers.map((b) => ({ label: b, value: "ติดเงื่อนไข", tone: "now" as const }))
            : [{ label: "ผ่านเงื่อนไขการลบทุกข้อ (spec 4.5.1)", value: "ผ่าน", tone: "count" as const }]
        }
        confirmLabel="ลบถาวร"
        busy={busy}
        confirmDisabled={deleteBlockers.length > 0 || confirmText.trim().toLowerCase() !== confirmTarget}
        error={error}
        onClose={() => setOpen(null)}
        onConfirm={() => run(() => deleteAction(userId, confirmText))}
      >
        {deleteBlockers.length === 0 && (
          <div className="field">
            <label htmlFor="del-confirm">
              พิมพ์ <b className="text-white">{confirmTarget}</b> เพื่อยืนยัน
            </label>
            <input id="del-confirm" className="input mono" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

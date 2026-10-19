"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addCentralAdmin, removeCentralAdmin, searchStaffAction, type StaffHit } from "@/app/(app)/role-actions";
import { ConfirmDialog } from "./confirm-dialog";
import { IconMoon, IconPlus } from "@/components/icons";

type Person = { id: number; name: string; email: string | null };

/**
 * แต่งตั้ง/ถอนผู้ดูแลกลาง (spec 3.2) — แสดงในหน้าภาพรวมของระบบ users เฉพาะผู้ดูแลกลาง
 * ต้องเหลืออย่างน้อย 1 คน และถอนตัวเองไม่ได้ (server ตรวจซ้ำ)
 */
export function CentralAdminManager({ selfId, centrals }: { selfId: number; centrals: (Person & { inactive: boolean })[] }) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<{ kind: "add" | "remove"; person: Person } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // ค้นหาที่ server (หน่วง 250ms) ไม่ส่งรายชื่อทั้งหมดมาที่เบราว์เซอร์
  const [hits, setHits] = useState<StaffHit[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!picking) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchStaffAction({ q, forAdmin: true });
      if (!cancelled) {
        setHits(r.hits);
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, picking]);
  const shown = hits.filter((c) => !centrals.some((a) => a.id === c.id));
  const activeCount = centrals.filter((c) => !c.inactive).length;

  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h2 id="admins" className="h2 !m-0">ผู้ดูแลกลาง</h2>
        <button type="button" className="btn btn-sm" aria-expanded={picking} onClick={() => setPicking((v) => !v)}><IconPlus />แต่งตั้ง</button>
      </div>
      <p className="small mb-2 mt-0">
        จัดการได้ทุกอย่าง รวมถึงข้อมูลอ่อนไหวและผู้ดูแลกลางคนอื่น ควรมีอย่างน้อย 2 คน เผื่อคนหนึ่งเข้าระบบไม่ได้
      </p>
      <p aria-live="polite" className="small m-0">{message}</p>

      {picking && (
        <div className="mb-3">
          <label htmlFor="central-q" className="label">ค้นหาบุคลากร</label>
          <input id="central-q" className="input mt-1.5" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อหรืออีเมล…" autoFocus />
          <ul className="m-0 mt-1 grid max-h-60 list-none overflow-auto p-0">
            {searching && <li className="small py-3">กำลังค้นหา…</li>}
            {!searching && shown.length === 0 && <li className="small py-3">ไม่พบ</li>}
            {shown.map((c) => (
              <li key={c.id} className="person-row">
                <div className="min-w-0 flex-1">
                  <div className="name">{c.name}</div>
                  <div className="sub">{c.email ?? "ไม่มีอีเมล"}</div>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => { setError(null); setTarget({ kind: "add", person: c }); }}>แต่งตั้ง</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {centrals.map((a) => {
        const reason = a.id === selfId ? "ถอนตัวเองไม่ได้" : !a.inactive && activeCount <= 1 ? "คนสุดท้าย ถอนไม่ได้" : null;
        return (
          <div key={a.id} className="person-row">
            <div className="min-w-0 flex-1">
              <div className="name" style={a.inactive ? { color: "var(--faint)" } : undefined}>
                {a.name} {a.id === selfId && <span className="chip chip-cyan">ท่าน</span>}
                {a.inactive && <span className="chip chip-off"><IconMoon /> ปิดใช้งาน</span>}
              </div>
              <div className="sub">{a.email ?? "ไม่มีอีเมล"}</div>
            </div>
            {reason ? (
              <span className="small">{reason}</span>
            ) : (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => { setError(null); setTarget({ kind: "remove", person: a }); }}>ถอน</button>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={target !== null}
        tone={target?.kind === "remove" ? "danger" : "pink"}
        title={target ? `${target.kind === "add" ? "แต่งตั้ง" : "ถอน"} ${target.person.name} ${target.kind === "add" ? "เป็นผู้ดูแลกลาง" : "จากผู้ดูแลกลาง"}?` : ""}
        impacts={
          target
            ? target.kind === "add"
              ? [
                  { label: "จัดการบุคลากร สิทธิ์ทุกระบบ ทะเบียนระบบ และผู้ดูแลทั้งหมด", value: "ทันที", tone: "count" },
                  { label: "เห็นและแก้ข้อมูลอ่อนไหว (เลขบัตร RFID เบอร์โทร)", value: "ทันที", tone: "later" },
                  { label: "แต่งตั้ง/ถอนผู้ดูแลกลางคนอื่นได้", value: "ทันที", tone: "later" },
                ]
              : [
                  { label: "จัดการทั้งระบบไม่ได้อีก", value: "ทันที", tone: "now" },
                  { label: "ถ้ายังดูแลระบบอื่นอยู่ กลับเป็นผู้ดูแลระบบ", value: "ทันที", tone: "muted" },
                ]
            : []
        }
        confirmLabel={target?.kind === "add" ? "แต่งตั้ง" : "ถอน"}
        busy={busy}
        error={error}
        onClose={() => setTarget(null)}
        onConfirm={() =>
          start(async () => {
            if (!target) return;
            const r = target.kind === "add" ? await addCentralAdmin(target.person.id) : await removeCentralAdmin(target.person.id);
            if (!r.ok) return setError(r.error);
            setTarget(null);
            setPicking(false);
            setMessage(r.message);
            router.refresh();
          })
        }
      />
    </>
  );
}

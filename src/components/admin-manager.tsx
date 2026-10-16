"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addAdmin, removeAdmin, searchStaffAction, type StaffHit } from "@/app/(app)/role-actions";
import { ConfirmDialog } from "./confirm-dialog";

type Person = { id: number; name: string; email: string | null };

/** แต่งตั้งและถอนผู้ดูแลของระบบ (spec 4.6) เฉพาะผู้ดูแลกลาง */
export function AdminManager({
  systemKey,
  systemName,
  admins,
}: {
  systemKey: string;
  systemName: string;
  admins: (Person & { since: string })[];
}) {
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
  const shown = hits.filter((c) => !admins.some((a) => a.id === c.id));

  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h2 id="admins" className="h2 !m-0">ผู้ดูแลที่ตั้งสิทธิ์ได้</h2>
        <button type="button" className="btn btn-sm" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>＋ แต่งตั้ง</button>
      </div>
      <p className="small mb-2 mt-0">ตั้งสิทธิ์ของ{systemName}ให้คนอื่นได้ในระบบจัดการผู้ใช้</p>
      <p aria-live="polite" className="small m-0">{message}</p>

      {picking && (
        <div className="mb-3">
          <label htmlFor="admin-q" className="label">ค้นหาบุคลากร</label>
          <input id="admin-q" className="input mt-1.5" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อหรืออีเมล…" autoFocus />
          <ul className="m-0 mt-1 grid max-h-60 list-none overflow-auto p-0">
            {searching && <li className="small py-3">กำลังค้นหา…</li>}
            {!searching && shown.length === 0 && <li className="small py-3">ไม่พบ</li>}
            {!searching && hits.length >= 50 && <li className="small py-2">แสดง 50 คนแรก พิมพ์ให้เจาะจงขึ้น</li>}
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

      {admins.length === 0 && <p className="small">ยังไม่มีผู้ดูแล ผู้ดูแลกลางตั้งสิทธิ์แทนได้</p>}
      {admins.map((a) => (
        <div key={a.id} className="person-row">
          <div className="min-w-0 flex-1">
            <div className="name">{a.name}</div>
            <div className="sub">ตั้งเมื่อ {a.since}</div>
          </div>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => { setError(null); setTarget({ kind: "remove", person: a }); }}>ถอน</button>
        </div>
      ))}

      <ConfirmDialog
        open={target !== null}
        tone={target?.kind === "remove" ? "danger" : "pink"}
        title={target ? `${target.kind === "add" ? "แต่งตั้ง" : "ถอน"} ${target.person.name} ${target.kind === "add" ? "เป็นผู้ดูแล" : "จากผู้ดูแล"}${systemName}?` : ""}
        impacts={
          target
            ? target.kind === "add"
              ? [
                  { label: `ตั้งสิทธิ์${systemName}ให้คนอื่นได้`, value: "ทันที", tone: "count" },
                  { label: "เข้าระบบจัดการผู้ใช้ได้ (ระดับ 50)", value: "ล็อกอินครั้งถัดไป", tone: "later" },
                ]
              : [
                  { label: `ตั้งสิทธิ์${systemName}ไม่ได้อีก`, value: "ทันที", tone: "now" },
                  { label: "ถ้าไม่ได้ดูแลระบบอื่น จะเข้าระบบนี้ไม่ได้", value: "ทันที", tone: "now" },
                  { label: `สิทธิ์ของตัวเองใน${systemName}`, value: "คงเดิม", tone: "muted" },
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
            const r = target.kind === "add" ? await addAdmin(systemKey, target.person.id) : await removeAdmin(systemKey, target.person.id);
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

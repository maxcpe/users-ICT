"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveRoles } from "@/app/(app)/role-actions";
import { describeLevel, type Level } from "@/lib/systems";
import { ConfirmDialog, type Impact } from "./confirm-dialog";
import { LevelChip } from "./level-chip";
import { LevelSelect } from "./level-select";

export type PersonSystemRow = {
  key: string;
  name: string;
  icon: string | null;
  note: string | null;
  levels: Level[];
  unconfirmed: boolean;
  current: number | null;
  /** เหตุผลที่แก้ไม่ได้ */
  locked?: string;
};

const label = (levels: Level[], v: number | null) => {
  const d = describeLevel(levels, v);
  return d.kind === "none" ? "ไม่มีสิทธิ์" : d.kind === "other" ? `ค่าอื่น (${d.value})` : d.label;
};

/** เกินจำนวนนี้จะแสดงช่องค้นหาและตัวกรอง "เฉพาะที่มีสิทธิ์" */
const FILTER_FROM = 8;

/** แถวระบบในหน้าสิทธิ์รายคน (design.md 5.13) */
export function PersonRoleEditor({ userId, personName, systems }: { userId: number; personName: string; systems: PersonSystemRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<Map<string, number | null>>(new Map());
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [q, setQ] = useState("");
  const [onlyHeld, setOnlyHeld] = useState(false);

  const byKey = new Map(systems.map((s) => [s.key, s]));
  const changes = [...pending].map(([systemKey, value]) => ({ userId, systemKey, value }));
  const impacts: Impact[] = changes.map((c) => {
    const s = byKey.get(c.systemKey)!;
    return { label: `${s.name}: ${label(s.levels, s.current)} → ${label(s.levels, c.value)}`, value: s.note ?? "", tone: "later" };
  });

  const held = systems.filter((s) => s.current !== null).length;
  const needle = q.trim().toLowerCase();
  // ระบบที่แก้ค้างไว้แสดงเสมอ จะได้ไม่หลุดสายตา
  const visible = systems.filter(
    (s) => pending.has(s.key) || ((!needle || `${s.name} ${s.key}`.toLowerCase().includes(needle)) && (!onlyHeld || s.current !== null)),
  );

  return (
    <>
      <p aria-live="polite" className="small m-0 mb-2">{message}</p>
      {systems.length > FILTER_FROM && (
        <div className="mb-2.5 flex flex-wrap items-end gap-2.5">
          <div className="grid min-w-[220px] flex-1 gap-1">
            <label htmlFor="role-q" className="label">ค้นหาระบบ</label>
            <input id="role-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อระบบ…" />
          </div>
          <button type="button" className="pill" aria-pressed={onlyHeld} onClick={() => setOnlyHeld((v) => !v)}>
            เฉพาะที่มีสิทธิ์ ({held})
          </button>
          <span className="small ml-auto self-center">แสดง {visible.length} จาก {systems.length} ระบบ</span>
        </div>
      )}
      <ul className="glass m-0 list-none p-0">
        {visible.length === 0 && <li className="small px-4 py-6 text-center">ไม่พบระบบที่ตรงกับตัวกรอง</li>}
        {visible.map((s) => {
          const value = pending.has(s.key) ? pending.get(s.key)! : s.current;
          return (
            <li
              key={s.key}
              className="flex flex-wrap items-center gap-3.5 px-4 py-3.5 [&+&]:border-t [&+&]:border-[var(--line-2)]"
              style={pending.has(s.key) ? { background: "color-mix(in srgb, var(--warn) 6%, transparent)" } : undefined}
            >
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl text-xl" style={{ background: "var(--glass-2)" }} aria-hidden="true">
                {s.icon ?? "📦"}
              </span>
              <div className="min-w-[180px] flex-1">
                <b>{s.name}</b>
                <div className="small">
                  {s.note}
                  {s.unconfirmed && <span className="chip chip-warn ml-1.5">⚠ ชื่อระดับยังไม่ยืนยัน</span>}
                </div>
              </div>
              {s.locked ? (
                <span className="flex flex-wrap items-center gap-2">
                  <LevelChip levels={s.levels} value={s.current} />
                  <span className="small">{s.locked}</span>
                </span>
              ) : (
                // มือถือ: ตัวเลือกเต็มกว้างใต้ชื่อระบบ · คอมพิวเตอร์: อยู่ขวาของชื่อ (design.md 5.13)
                <div className="w-full min-[821px]:w-auto min-[821px]:min-w-[240px]">
                <LevelSelect
                  levels={s.levels}
                  original={s.current}
                  value={value}
                  label={`สิทธิ์${s.name}ของ ${personName}`}
                  onChange={(v) =>
                    setPending((p) => {
                      const n = new Map(p);
                      if (v === s.current) n.delete(s.key);
                      else n.set(s.key, v);
                      return n;
                    })
                  }
                />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {changes.length > 0 && (
        <div className="bulk" role="region" aria-label="การเปลี่ยนที่ยังไม่บันทึก">
          <span>เปลี่ยน <b>{changes.length}</b> ระบบ</span>
          <span className="ml-auto flex gap-2">
            <button type="button" className="btn" onClick={() => setPending(new Map())}>ยกเลิก</button>
            <button type="button" className="btn btn-primary" onClick={() => { setError(null); setConfirm(true); }}>บันทึกสิทธิ์</button>
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={`บันทึกสิทธิ์ของ ${personName}`}
        impacts={impacts}
        confirmLabel={`ยืนยัน ${changes.length} ระบบ`}
        busy={busy}
        error={error}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          start(async () => {
            const r = await saveRoles(changes);
            if (!r.ok) return setError(r.error);
            setConfirm(false);
            setPending(new Map());
            setMessage(r.message);
            router.refresh();
          })
        }
      />
    </>
  );
}

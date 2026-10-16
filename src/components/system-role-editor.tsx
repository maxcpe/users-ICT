"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { saveRoles, searchStaffAction, type StaffHit } from "@/app/(app)/role-actions";
import { describeLevel, type Level } from "@/lib/systems";
import { ConfirmDialog, type Impact } from "./confirm-dialog";
import { LevelChip } from "./level-chip";
import { LevelSelect } from "./level-select";

export type EditableRow = {
  id: number;
  name: string;
  email: string | null;
  branch: string | null;
  level: number | null;
  /** เหตุผลที่แก้ไม่ได้ เช่น "ท่าน" หรือ "ปิดใช้งาน" */
  locked?: string;
};

type Candidate = StaffHit;

const label = (levels: Level[], v: number | null) => {
  const d = describeLevel(levels, v);
  return d.kind === "none" ? "ไม่มีสิทธิ์" : d.kind === "other" ? `ค่าอื่น (${d.value})` : d.label;
};

/**
 * ตารางสิทธิ์ของระบบเดียว รับเฉพาะแถวของหน้าปัจจุบัน (ค้นหา/กรอง/แบ่งหน้าที่ server ผ่าน URL)
 * การเปลี่ยนที่ยังไม่บันทึกจำไว้ข้ามหน้า และแสดงไว้บนสุดของตาราง
 */
export function SystemRoleEditor({
  system,
  rows,
  canAdd = true,
}: {
  system: { key: string; name: string; note: string | null; levels: Level[] };
  rows: EditableRow[];
  canAdd?: boolean;
}) {
  const router = useRouter();
  // userId → แถวเดิม (ค่าก่อนแก้) + ค่าใหม่
  const [pending, setPending] = useState<Map<number, { row: EditableRow; value: number | null }>>(new Map());
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Map<number, Candidate>>(new Map());
  const [hits, setHits] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [addLevel, setAddLevel] = useState<number>(system.levels[0]?.value ?? 0);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // แถวที่ยังไม่บันทึกแสดงบนสุดเสมอ (รวมคนที่เพิ่มใหม่และคนจากหน้าอื่น) จะได้ไม่หลุดสายตา
  const pendingRows = [...pending.values()].map((p) => p.row);
  const visibleRows = [...pendingRows, ...rows.filter((r) => !pending.has(r.id))];
  const set = (row: EditableRow, v: number | null) =>
    setPending((p) => {
      const n = new Map(p);
      if (v === row.level) n.delete(row.id);
      else n.set(row.id, { row, value: v });
      return n;
    });

  const changes = [...pending].map(([userId, p]) => ({ userId, systemKey: system.key, value: p.value }));
  const impacts: Impact[] = [...pending.values()].slice(0, 8).map((p) => ({
    label: p.row.name,
    value: `${label(system.levels, p.row.level)} → ${label(system.levels, p.value)}`,
    tone: p.value === null ? "now" : "count",
  }));
  if (changes.length > 8) impacts.push({ label: `และอีก ${changes.length - 8} คน`, value: "", tone: "muted" });

  // ค้นที่ server ด้วยชื่อ อีเมล หรือสังกัด (หน่วง 250ms, ไม่เกิน 50 คน)
  useEffect(() => {
    if (!adding) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchStaffAction({ q, systemKey: system.key });
      if (!cancelled) {
        setHits(r);
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, adding, system.key]);
  const shown = hits.filter((c) => !pending.has(c.id));
  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.id));
  const togglePick = (c: Candidate, on: boolean) =>
    setPicked((p) => {
      const n = new Map(p);
      if (on) n.set(c.id, c);
      else n.delete(c.id);
      return n;
    });
  const addPicked = () => {
    setPending((p) => {
      const n = new Map(p);
      for (const c of picked.values()) if (!n.has(c.id)) n.set(c.id, { row: { ...c, level: null }, value: addLevel });
      return n;
    });
    setPicked(new Map());
    setQ("");
  };
  const addLevelLabel = system.levels.find((l) => l.value === addLevel)?.label ?? "";

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        {canAdd && (
          <button type="button" className="btn btn-primary" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
            ＋ เพิ่มคน
          </button>
        )}
        <p aria-live="polite" className="small m-0">{message}</p>
      </div>

      {canAdd && adding && (
        <div className="glass pad mb-3.5">
          <label htmlFor="add-q" className="label">ค้นหาบุคลากรที่ยังไม่มีสิทธิ์ใน{system.name} (ชื่อ อีเมล หรือสังกัด)</label>
          <input id="add-q" className="input mt-1.5" value={q} onChange={(e) => setQ(e.target.value)} placeholder="เช่น วิทยาการคอมพิวเตอร์" autoFocus />

          <label className="mt-2 flex min-h-11 items-center gap-3 border-b border-[#ffffff14] pb-1">
            <input
              type="checkbox"
              className="check"
              checked={allShownPicked}
              disabled={shown.length === 0}
              onChange={(e) =>
                setPicked((p) => {
                  const n = new Map(p);
                  for (const c of shown) {
                    if (e.target.checked) n.set(c.id, c);
                    else n.delete(c.id);
                  }
                  return n;
                })
              }
            />
            <span className="small">เลือกทั้งหมดที่แสดง ({shown.length} คน)</span>
          </label>

          <ul className="m-0 grid max-h-80 list-none overflow-auto p-0">
            {searching && <li className="small py-4 text-center">กำลังค้นหา…</li>}
            {!searching && shown.length === 0 && <li className="small py-4 text-center">ไม่พบบุคลากรที่ยังไม่มีสิทธิ์</li>}
            {shown.map((c) => (
              <li key={c.id}>
                <label className="person-row cursor-pointer">
                  <input type="checkbox" className="check" checked={picked.has(c.id)} onChange={(e) => togglePick(c, e.target.checked)} />
                  <span className="min-w-0 flex-1">
                    <span className="name block">{c.name}</span>
                    <span className="sub block">{c.email ?? "ไม่มีอีเมล"}{c.branch ? ` · ${c.branch}` : ""}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {!searching && hits.length >= 50 && (
            <p className="small mb-0 mt-1">แสดง 50 คนแรก พิมพ์ให้เจาะจงขึ้น (ค้นใหม่ได้ คนที่เลือกไว้ยังอยู่)</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <label htmlFor="add-level" className="label">เพิ่มเป็น</label>
            <select id="add-level" className="input !w-auto min-w-[200px]" value={addLevel} onChange={(e) => setAddLevel(Number(e.target.value))}>
              {system.levels.map((l) => <option key={l.value} value={l.value}>{l.label} ({l.value})</option>)}
            </select>
            <button type="button" className="btn btn-primary" disabled={picked.size === 0} onClick={addPicked}>
              เพิ่ม {picked.size} คนเป็น{addLevelLabel}
            </button>
          </div>
          <p className="small mb-0 mt-2">ยังไม่บันทึกจนกว่าจะกด &quot;บันทึก&quot; ที่แถบด้านล่าง</p>
        </div>
      )}

      <div className="glass table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">ชื่อ</th>
              <th scope="col" className="hide-sm">สังกัด</th>
              <th scope="col">สิทธิ์{system.name}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr><td colSpan={3} className="py-10 text-center text-muted">ไม่พบคนที่ตรงกับตัวกรอง</td></tr>
            )}
            {visibleRows.map((r) => {
              const p = pending.get(r.id);
              const value = p ? p.value : r.level;
              return (
                <tr key={r.id} style={pending.has(r.id) ? { background: "#ffd23d10" } : undefined}>
                  <td>
                    <div className="name">
                      {r.name}{" "}
                      {r.locked === "ท่าน" && <span className="chip chip-cyan">ท่าน</span>}
                      {pending.has(r.id) && <span className="chip chip-warn">ยังไม่บันทึก</span>}
                    </div>
                    <div className="sub">{r.email ?? "ไม่มีอีเมล"}</div>
                  </td>
                  <td className="hide-sm">{r.branch ?? "—"}</td>
                  <td>
                    {r.locked ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <LevelChip levels={system.levels} value={r.level} />
                        <span className="small">{r.locked === "ท่าน" ? "แก้สิทธิ์ตัวเองไม่ได้" : r.locked}</span>
                      </span>
                    ) : (
                      <LevelSelect
                        levels={system.levels}
                        original={r.level}
                        value={value}
                        onChange={(v) => set(r, v)}
                        label={`สิทธิ์${system.name}ของ ${r.name}`}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {changes.length > 0 && (
        <div className="bulk" role="region" aria-label="การเปลี่ยนที่ยังไม่บันทึก">
          <span>เปลี่ยน <b>{changes.length}</b> คน</span>
          {system.note && <span className="small">{system.note}</span>}
          <span className="ml-auto flex gap-2">
            <button type="button" className="btn" onClick={() => setPending(new Map())}>ยกเลิก</button>
            <button type="button" className="btn btn-primary" onClick={() => { setError(null); setConfirm(true); }}>บันทึก</button>
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={`ตั้งสิทธิ์${system.name} ${changes.length} คน`}
        description={system.note ?? undefined}
        impacts={impacts}
        confirmLabel={`ยืนยัน ${changes.length} คน`}
        tone={changes.length > 1 ? "cyan" : "pink"}
        busy={busy}
        error={error}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          start(async () => {
            const r = await saveRoles(changes);
            if (!r.ok) return setError(r.error);
            setConfirm(false);
            setPending(new Map());
            setAdding(false);
            setMessage(r.message);
            router.refresh();
          })
        }
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkSetRole } from "@/app/(app)/role-actions";
import type { Level } from "@/lib/systems";
import { ConfirmDialog } from "./confirm-dialog";
import { LevelChip } from "./level-chip";

export type PeopleRow = {
  id: number;
  name: string;
  email: string | null;
  branch: string | null;
  job: string | null;
  roles: Record<string, number | null>;
  centralLevel: number | null;
  inactiveReason: string | null;
  flags: string[];
};

export type BulkSystem = { key: string; name: string; note: string | null; levels: Level[] };

/** แสดงสิทธิ์ไม่เกินเท่านี้ต่อแถว ที่เหลือเป็น "+n ระบบ" (กดดูครบในหน้ารายคน) */
const MAX_CHIPS = 4;

export function PeopleTable({
  rows,
  systems,
  selfId,
  bulkKeys,
}: {
  rows: PeopleRow[];
  systems: BulkSystem[];
  selfId: number;
  /** ระบบที่ตั้งหลายคนได้ (โหมดอ่านข้อมูลจริงตัดระบบเดิมออก) */
  bulkKeys: string[];
}) {
  const bulkSystems = systems.filter((s) => bulkKeys.includes(s.key));
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState(false);
  const [systemKey, setSystemKey] = useState(bulkSystems[0]?.key ?? "");
  const [value, setValue] = useState<number | null>(bulkSystems[0]?.levels[0]?.value ?? null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const system = systems.find((s) => s.key === systemKey);
  const picked = rows.filter((r) => selected.has(r.id));
  const skipped = picked.filter((r) => r.inactiveReason !== null).length;
  const same = picked.filter((r) => r.inactiveReason === null && (r.roles[systemKey] ?? null) === value).length;
  const change = picked.length - skipped - same;
  const valueLabel = value === null ? "ไม่มีสิทธิ์" : (system?.levels.find((l) => l.value === value)?.label ?? String(value));
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: number, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <>
      <p aria-live="polite" className="small m-0 mb-2">{message}</p>
      <div className="glass table-wrap">
        <table className="table">
          <thead>
            <tr>
              {bulkSystems.length > 0 && (
                <th scope="col" className="w-11">
                  <input
                    type="checkbox"
                    className="check"
                    aria-label="เลือกทุกคนในหน้านี้"
                    checked={allChecked}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </th>
              )}
              <th scope="col">ชื่อ</th>
              <th scope="col" className="hide-sm">สังกัด</th>
              <th scope="col">สิทธิ์</th>
              <th scope="col"><span className="sr-only">เปิด</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                {bulkSystems.length > 0 && (
                  <td>
                    <input
                      type="checkbox"
                      className="check"
                      aria-label={`เลือก ${p.name}`}
                      checked={selected.has(p.id)}
                      disabled={p.id === selfId}
                      title={p.id === selfId ? "ตั้งสิทธิ์ตัวเองไม่ได้" : undefined}
                      onChange={(e) => toggle(p.id, e.target.checked)}
                    />
                  </td>
                )}
                <td>
                  <div className="name" style={p.inactiveReason ? { color: "var(--faint)" } : undefined}>{p.name}</div>
                  <div className="sub">{p.email ?? "ไม่มีอีเมล"}</div>
                </td>
                <td className="hide-sm">
                  {p.branch ?? "—"}
                  {p.job && p.branch === "สำนักงานคณะ" ? <span className="sub"> · {p.job}</span> : null}
                </td>
                <td>
                  <div className="chips">
                    {p.centralLevel === 99 && <span className="chip chip-violet">🛡️ ผู้ดูแลกลาง</span>}
                    {p.centralLevel === 50 && <span className="chip chip-violet">🔧 ผู้ดูแลระบบ</span>}
                    {p.inactiveReason ? (
                      <span className="chip chip-off">💤 ปิดใช้งาน · {p.inactiveReason}</span>
                    ) : (
                      (() => {
                        const held = systems.map((s, i) => ({ s, i })).filter(({ s }) => p.roles[s.key] != null);
                        return (
                          <>
                            {held.slice(0, MAX_CHIPS).map(({ s, i }) => (
                              <LevelChip key={s.key} levels={s.levels} value={p.roles[s.key]} systemName={s.name} colorIndex={i} />
                            ))}
                            {held.length > MAX_CHIPS && (
                              <Link
                                href={`/u/${p.id}`}
                                className="chip chip-off no-underline"
                                title={held.slice(MAX_CHIPS).map(({ s }) => s.name).join(", ")}
                              >
                                +{held.length - MAX_CHIPS} ระบบ
                              </Link>
                            )}
                          </>
                        );
                      })()
                    )}
                    {!p.inactiveReason && systems.every((s) => p.roles[s.key] == null) && <span className="chip chip-off">ยังไม่มีสิทธิ์</span>}
                    {p.flags.map((f) => <span key={f} className="chip chip-warn">⚠ {f}</span>)}
                  </div>
                </td>
                <td>
                  <Link href={`/u/${p.id}`} className="btn btn-sm" aria-label={`เปิด ${p.name}`}>เปิด</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="bulk" role="region" aria-label="เลือกหลายคน">
          <span>เลือก <b>{selected.size}</b> คน</span>
          <span className="ml-auto flex gap-2">
            <button type="button" className="btn" onClick={() => setSelected(new Set())}>ยกเลิกการเลือก</button>
            <button type="button" className="btn btn-cyan" onClick={() => { setError(null); setDialog(true); }}>ตั้งสิทธิ์…</button>
          </span>
        </div>
      )}

      <ConfirmDialog
        open={dialog}
        tone="cyan"
        title={`ตั้งสิทธิ์ ${picked.length} คน`}
        impacts={[
          { label: `เปลี่ยนเป็น "${valueLabel}"`, value: `${change} คน`, tone: "count" },
          { label: `เป็น "${valueLabel}" อยู่แล้ว`, value: `${same} คน`, tone: "muted" },
          { label: "ข้าม (ปิดใช้งาน)", value: `${skipped} คน`, tone: "muted" },
        ]}
        description={system?.note ?? undefined}
        confirmLabel={`ยืนยัน ${change} คน`}
        busy={busy}
        error={error}
        onClose={() => setDialog(false)}
        onConfirm={() =>
          start(async () => {
            if (change === 0) return setError("ไม่มีใครต้องเปลี่ยน");
            const r = await bulkSetRole({ systemKey, value, userIds: picked.map((p) => p.id) });
            if (!r.ok) return setError(r.error);
            setDialog(false);
            setSelected(new Set());
            setMessage(r.message);
            router.refresh();
          })
        }
      >
        <div className="field">
          <label htmlFor="bulk-system">ระบบ</label>
          <select
            id="bulk-system"
            className="input"
            value={systemKey}
            onChange={(e) => {
              setSystemKey(e.target.value);
              setValue(bulkSystems.find((s) => s.key === e.target.value)?.levels[0]?.value ?? null);
            }}
          >
            {bulkSystems.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bulk-level">ระดับ</label>
          <select
            id="bulk-level"
            className="input"
            value={value === null ? "" : String(value)}
            onChange={(e) => setValue(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">ไม่มีสิทธิ์</option>
            {system?.levels.map((l) => <option key={l.value} value={l.value}>{l.label} ({l.value})</option>)}
          </select>
        </div>
      </ConfirmDialog>
    </>
  );
}

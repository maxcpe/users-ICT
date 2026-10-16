"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addAllMatching, saveRoles } from "@/app/(app)/role-actions";
import { describeLevel, levelSetText, type Level } from "@/lib/systems";
import { ConfirmDialog, type Impact } from "./confirm-dialog";
import { LevelChip } from "./level-chip";
import { LevelMultiSelect, LevelSetChip } from "./level-multi";
import { LevelSelect } from "./level-select";

export type EditableRow = {
  id: number;
  name: string;
  email: string | null;
  branch: string | null;
  /** ระบบปกติ: ค่าเดียว (null = ไม่มีสิทธิ์) */
  level: number | null;
  /** ระบบหลายสิทธิ์: ทุกบทบาท ([] = ไม่มีสิทธิ์) */
  levels: number[];
  /** เหตุผลที่แก้ไม่ได้ เช่น "ท่าน" หรือ "ปิดใช้งาน" */
  locked?: string;
};

/** ตัวกรองของหน้า (อยู่ใน URL) ใช้กับ "ตั้งทั้งหมด" ให้ได้กลุ่มเดียวกับที่เห็นในตาราง */
export type PeopleFilter = { q: string; line: "" | "academic" | "support"; branch: string; job: string };

type Change = { userId: number; systemKey: string; value: number | null; levels?: number[] };
type Pending = { row: EditableRow; value: number | null; levels: number[] };

const ADD_ALL_MAX = 500;

const label = (levels: Level[], v: number | null) => {
  const d = describeLevel(levels, v);
  return d.kind === "none" ? "ไม่มีสิทธิ์" : d.kind === "other" ? `ค่าอื่น (${d.value})` : d.label;
};
const sameSet = (a: readonly number[], b: readonly number[]) => {
  const x = [...new Set(a)].sort((m, n) => m - n);
  const y = [...new Set(b)].sort((m, n) => m - n);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * ตารางสิทธิ์ของระบบเดียว (design.md 7 แท็บผู้ใช้) — ทางเดียวในการตั้งสิทธิ์:
 * - mode "holders": คนที่มีสิทธิ์ · mode "none": คนที่ยังไม่มีสิทธิ์ (= เพิ่มคน)
 * - เลือกในแถว หรือติ๊กหลายแถวแล้วตั้งจากแถบล่าง → พักไว้ แล้วบันทึกรวมที่แถบล่าง (dialog สรุป)
 * - "ตั้งทั้งหมด" (เฉพาะ mode none) ครอบคลุมทุกหน้าตามตัวกรอง จึงบันทึกทันทีหลัง dialog ยืนยัน
 * - ระบบหลายสิทธิ์ (spec 2.3): ติ๊กได้หลายบทบาทต่อคน แถบล่างเป็น "เพิ่ม/ถอนบทบาท"
 */
export function SystemRoleEditor({
  system,
  rows,
  mode,
  matched,
  filter,
  canEdit = true,
}: {
  system: { key: string; name: string; note: string | null; levels: Level[]; multi: boolean };
  rows: EditableRow[];
  mode: "holders" | "none";
  /** จำนวนแถวที่ตรงตัวกรองทั้งหมด (ทุกหน้า) */
  matched: number;
  filter: PeopleFilter;
  /** แก้สิทธิ์ได้ (ไม่ใช่โหมดอ่านข้อมูลจริง และไม่ใช่ระบบ users) */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const multi = system.multi;
  const [pending, setPending] = useState<Map<number, Pending>>(new Map());
  const [selected, setSelected] = useState<Map<number, EditableRow>>(new Map());
  const firstLevel = system.levels[0]?.value ?? null;
  const [bulkLevel, setBulkLevel] = useState<number | null>(firstLevel);
  const [allLevel, setAllLevel] = useState<number>(firstLevel ?? 0);
  const [confirm, setConfirm] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  // ค่าก่อนแก้ของการบันทึกครั้งล่าสุด สำหรับปุ่ม "เลิกทำ"
  const [undo, setUndo] = useState<Change[] | null>(null);
  const [busy, start] = useTransition();

  const filtered = !!(filter.q || filter.line || filter.branch || filter.job);
  const pendingRows = [...pending.values()].map((p) => p.row);
  const visibleRows = [...pendingRows, ...rows.filter((r) => !pending.has(r.id))];
  const selectable = visibleRows.filter((r) => !r.locked);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  /** ค่าปัจจุบันบนจอ (รวมที่พักไว้) */
  const shownLevels = (r: EditableRow) => pending.get(r.id)?.levels ?? r.levels;
  const shownLevel = (r: EditableRow) => (pending.has(r.id) ? pending.get(r.id)!.value : r.level);

  const stage = (list: { row: EditableRow; value?: number | null; levels?: number[] }[]) => {
    setUndo(null);
    setNotice(null);
    setPending((p) => {
      const n = new Map(p);
      for (const { row, value = null, levels = [] } of list) {
        const unchanged = multi ? sameSet(levels, row.levels) : value === row.level;
        if (unchanged) n.delete(row.id);
        else n.set(row.id, { row, value, levels });
      }
      return n;
    });
  };
  const toggle = (row: EditableRow, on: boolean) =>
    setSelected((s) => {
      const n = new Map(s);
      if (on) n.set(row.id, row);
      else n.delete(row.id);
      return n;
    });
  const applySelected = (op: "set" | "add" | "remove") => {
    const rowsSel = [...selected.values()];
    if (!multi) stage(rowsSel.map((row) => ({ row, value: bulkLevel })));
    else if (bulkLevel !== null)
      stage(
        rowsSel.map((row) => {
          const cur = shownLevels(row);
          const levels = op === "add" ? [...new Set([...cur, bulkLevel])] : cur.filter((v) => v !== bulkLevel);
          return { row, levels };
        }),
      );
    setSelected(new Map());
  };

  const changes: Change[] = [...pending].map(([userId, p]) =>
    multi ? { userId, systemKey: system.key, value: null, levels: p.levels } : { userId, systemKey: system.key, value: p.value },
  );
  const text = (p: Pending, before: boolean) =>
    multi ? levelSetText(system.levels, before ? p.row.levels : p.levels) : label(system.levels, before ? p.row.level : p.value);
  const impacts: Impact[] = [...pending.values()].slice(0, 8).map((p) => ({
    label: p.row.name,
    value: `${text(p, true)} → ${text(p, false)}`,
    tone: (multi ? p.levels.length === 0 : p.value === null) ? "now" : "count",
  }));
  if (changes.length > 8) impacts.push({ label: `และอีก ${changes.length - 8} คน`, value: "", tone: "muted" });

  const allLevelLabel = label(system.levels, allLevel);
  const addAllBlocked =
    pending.size > 0
      ? `มีการเปลี่ยนที่ยังไม่บันทึก ${pending.size} คน บันทึกหรือยกเลิกก่อน`
      : matched > ADD_ALL_MAX
        ? `เกิน ${ADD_ALL_MAX} คนต่อครั้ง กรองตามสาย สังกัด หรืองานให้แคบลง`
        : null;
  const n = (v: number) => v.toLocaleString("th-TH");

  const emptyText = filtered
    ? "ไม่พบคนที่ตรงกับตัวกรอง"
    : mode === "none"
      ? `บุคลากรทุกคนมีสิทธิ์ใน${system.name}แล้ว`
      : `ยังไม่มีใครมีสิทธิ์ใน${system.name} — กด "＋ เพิ่มคน" เพื่อเริ่มตั้งสิทธิ์`;

  return (
    <>
      {notice && (
        <div className={`callout ${notice.tone === "ok" ? "callout-info" : "callout-bad"} mb-3 items-center`} role="status">
          <span aria-hidden="true">{notice.tone === "ok" ? "✓" : "⚠"}</span>
          <span className="flex-1">{notice.text}</span>
          {undo && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await saveRoles(undo);
                  setUndo(null);
                  setNotice(r.ok ? { tone: "ok", text: `เลิกทำแล้ว · ${r.message}` } : { tone: "bad", text: r.error });
                  router.refresh();
                })
              }
            >
              ↶ เลิกทำ
            </button>
          )}
        </div>
      )}

      {mode === "none" && canEdit && (
        <div className="callout callout-info mb-3 flex-wrap items-center">
          <span aria-hidden="true">ℹ️</span>
          <span className="min-w-[220px] flex-1">
            ยังไม่มีสิทธิ์ใน{system.name} {n(matched)} คน{filtered ? "ที่ตรงกับตัวกรอง" : ""} — {multi ? "ติ๊กบทบาทในแถว" : "เลือกระดับในแถว"}
            หรือติ๊กหลายคนแล้วตั้งพร้อมกัน
            {addAllBlocked && matched > 0 && <span className="mt-1 block text-warn-ink">⚠ &quot;ตั้งทั้งหมด&quot; ใช้ไม่ได้: {addAllBlocked}</span>}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-cyan"
            disabled={matched === 0 || addAllBlocked !== null}
            onClick={() => { setError(null); setConfirmAll(true); }}
          >
            ตั้งทั้งหมด {n(matched)} คน…
          </button>
        </div>
      )}

      <div className="glass table-wrap">
        <table className="table">
          <thead>
            <tr>
              {canEdit && (
                <th scope="col" className="w-11">
                  <input
                    type="checkbox"
                    className="check"
                    aria-label="เลือกทุกคนในหน้านี้"
                    checked={allSelected}
                    disabled={selectable.length === 0}
                    onChange={(e) => setSelected(e.target.checked ? new Map(selectable.map((r) => [r.id, r])) : new Map())}
                  />
                </th>
              )}
              <th scope="col">ชื่อ</th>
              <th scope="col" className="hide-sm">สังกัด</th>
              <th scope="col">{multi ? "บทบาทใน" : "สิทธิ์"}{system.name}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr><td colSpan={canEdit ? 4 : 3} className="py-10 text-center text-muted">{emptyText}</td></tr>
            )}
            {visibleRows.map((r) => {
              const p = pending.get(r.id);
              return (
                <tr key={r.id} style={p ? { background: "color-mix(in srgb, var(--warn) 6%, transparent)" } : undefined}>
                  {canEdit && (
                    <td>
                      <input
                        type="checkbox"
                        className="check"
                        aria-label={`เลือก ${r.name}`}
                        checked={selected.has(r.id)}
                        disabled={!!r.locked}
                        onChange={(e) => toggle(r, e.target.checked)}
                      />
                    </td>
                  )}
                  <td>
                    <div className="name">
                      {r.name}{" "}
                      {r.locked === "ท่าน" && <span className="chip chip-cyan">ท่าน</span>}
                      {p && <span className="chip chip-warn">ยังไม่บันทึก</span>}
                    </div>
                    <div className="sub">{r.email ?? "ไม่มีอีเมล"}</div>
                  </td>
                  <td className="hide-sm">{r.branch ?? "—"}</td>
                  <td>
                    {r.locked ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {multi ? <LevelSetChip levels={system.levels} values={r.levels} /> : <LevelChip levels={system.levels} value={r.level} />}
                        <span className="small">{r.locked === "ท่าน" ? "แก้สิทธิ์ตัวเองไม่ได้" : r.locked}</span>
                      </span>
                    ) : multi ? (
                      <LevelMultiSelect
                        levels={system.levels}
                        original={r.levels}
                        value={shownLevels(r)}
                        onChange={(levels) => stage([{ row: r, levels }])}
                        label={`บทบาทใน${system.name}ของ ${r.name}`}
                      />
                    ) : (
                      <LevelSelect
                        levels={system.levels}
                        original={r.level}
                        value={shownLevel(r)}
                        onChange={(v) => stage([{ row: r, value: v }])}
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

      {selected.size > 0 ? (
        <div className="bulk" role="region" aria-label="เลือกหลายคน">
          <span>เลือก <b>{selected.size}</b> คน</span>
          {pending.size > 0 && <span className="small">มีการเปลี่ยนค้าง {pending.size} คน</span>}
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <label htmlFor="bulk-level" className="sr-only">{multi ? "บทบาท" : "ระดับที่จะตั้งให้คนที่เลือก"}</label>
            <select
              id="bulk-level"
              className="input !w-auto min-w-[180px]"
              value={bulkLevel === null ? "" : String(bulkLevel)}
              onChange={(e) => setBulkLevel(e.target.value === "" ? null : Number(e.target.value))}
            >
              {!multi && mode === "holders" && <option value="">ไม่มีสิทธิ์</option>}
              {system.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            {multi ? (
              <>
                <button type="button" className="btn btn-cyan" disabled={bulkLevel === null} onClick={() => applySelected("add")}>เพิ่มบทบาทนี้</button>
                {mode === "holders" && (
                  <button type="button" className="btn btn-danger" disabled={bulkLevel === null} onClick={() => applySelected("remove")}>ถอนบทบาทนี้</button>
                )}
              </>
            ) : (
              <button type="button" className="btn btn-cyan" onClick={() => applySelected("set")}>ตั้งให้ที่เลือก</button>
            )}
            <button type="button" className="btn" onClick={() => setSelected(new Map())}>ยกเลิกการเลือก</button>
          </span>
        </div>
      ) : (
        changes.length > 0 && (
          <div className="bulk" role="region" aria-label="การเปลี่ยนที่ยังไม่บันทึก">
            <span>เปลี่ยน <b>{changes.length}</b> คน</span>
            {system.note && <span className="small">{system.note}</span>}
            <span className="ml-auto flex gap-2">
              <button type="button" className="btn" onClick={() => setPending(new Map())}>ยกเลิก</button>
              <button type="button" className="btn btn-primary" onClick={() => { setError(null); setConfirm(true); }}>บันทึก</button>
            </span>
          </div>
        )
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
            setUndo(
              [...pending].map(([userId, p]) =>
                multi ? { userId, systemKey: system.key, value: null, levels: p.row.levels } : { userId, systemKey: system.key, value: p.row.level },
              ),
            );
            setConfirm(false);
            setPending(new Map());
            setNotice({ tone: "ok", text: r.message });
            router.refresh();
          })
        }
      />

      <ConfirmDialog
        open={confirmAll}
        tone="cyan"
        title={`ตั้งสิทธิ์${system.name}ให้ ${n(matched)} คน?`}
        description={system.note ?? undefined}
        impacts={[
          { label: `ได้${multi ? "บทบาท" : "สิทธิ์"} "${allLevelLabel}"`, value: `${n(matched)} คน · ทันที`, tone: "count" },
          ...(filter.q ? [{ label: "คำค้น", value: filter.q, tone: "muted" as const }] : []),
          ...(filter.line ? [{ label: "สาย", value: filter.line === "academic" ? "สายวิชาการ" : "สายสนับสนุน", tone: "muted" as const }] : []),
          ...(filter.branch ? [{ label: "สังกัด", value: filter.branch, tone: "muted" as const }] : []),
          ...(filter.job ? [{ label: "งาน", value: filter.job, tone: "muted" as const }] : []),
          ...(!filtered ? [{ label: "ไม่ได้กรอง", value: "ทุกคนที่ยังไม่มีสิทธิ์", tone: "now" as const }] : []),
          { label: "คนที่ปิดใช้งานและตัวท่านเอง", value: "ข้าม", tone: "muted" },
        ]}
        confirmLabel={`ยืนยัน ${n(matched)} คน`}
        busy={busy}
        error={error}
        onClose={() => setConfirmAll(false)}
        onConfirm={() =>
          start(async () => {
            const r = await addAllMatching({ ...filter, systemKey: system.key, value: allLevel });
            if (!r.ok) return setError(r.error);
            setConfirmAll(false);
            setUndo(null);
            setNotice({ tone: "ok", text: r.message });
            router.refresh();
          })
        }
      >
        <div className="field">
          <label htmlFor="all-level">{multi ? "บทบาท" : "ระดับ"}</label>
          <select id="all-level" className="input" value={allLevel} onChange={(e) => setAllLevel(Number(e.target.value))}>
            {system.levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </ConfirmDialog>
    </>
  );
}

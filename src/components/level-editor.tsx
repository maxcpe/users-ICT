"use client";

import { useId, useState } from "react";
import type { Level } from "@/lib/systems";

type Row = { id: number; value: string; label: string; description: string };

/**
 * แก้รายการระดับของระบบ ส่งค่าเป็น JSON ใน hidden input ชื่อ `levels`
 * ระดับที่มีคนใช้อยู่ล็อกค่าและปุ่มลบ (ตรวจซ้ำฝั่ง server)
 */
export function LevelEditor({ initial, inUse = {} }: { initial: Level[]; inUse?: Record<number, number> }) {
  const base = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((l, i) => ({ id: i, value: String(l.value), label: l.label, description: l.description ?? "" })),
  );
  const [nextId, setNextId] = useState(initial.length);

  const json = JSON.stringify(
    rows
      .filter((r) => r.value !== "" || r.label !== "")
      .map((r) => ({ value: Number(r.value), label: r.label, ...(r.description ? { description: r.description } : {}) })),
  );
  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div>
      <input type="hidden" name="levels" value={json} />
      <div className="glass mb-3">
        <div className="lv-row small" aria-hidden="true">
          <span>ค่า</span>
          <span>ชื่อที่แสดง</span>
          <span className="desc-col">คำอธิบาย</span>
          <span />
        </div>
        {rows.map((r, i) => {
          const locked = (inUse[Number(r.value)] ?? 0) > 0 && initial.some((l) => l.value === Number(r.value));
          const n = i + 1;
          return (
            <div className="lv-row" key={r.id}>
              <input
                className="input mono"
                inputMode="numeric"
                aria-label={`ค่าระดับที่ ${n}`}
                value={r.value}
                readOnly={locked}
                aria-describedby={locked ? `${base}-locked-${r.id}` : undefined}
                onChange={(e) => update(r.id, { value: e.target.value.replace(/\D/g, "").slice(0, 3) })}
              />
              <input className="input" aria-label={`ชื่อระดับที่ ${n}`} value={r.label} maxLength={60} onChange={(e) => update(r.id, { label: e.target.value })} />
              <input
                className="input desc-col"
                aria-label={`คำอธิบายระดับที่ ${n}`}
                value={r.description}
                maxLength={120}
                onChange={(e) => update(r.id, { description: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={locked ? `ลบระดับที่ ${n} ไม่ได้ เพราะมีคนใช้อยู่` : `ลบระดับที่ ${n}`}
                disabled={locked}
                onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
              >
                ✕
              </button>
              {locked && (
                <span id={`${base}-locked-${r.id}`} className="small" style={{ gridColumn: "1 / -1" }}>
                  มีคนใช้อยู่ {inUse[Number(r.value)]} คน ลบหรือเปลี่ยนค่าไม่ได้
                </span>
              )}
            </div>
          );
        })}
        <div className="lv-row">
          <span className="small" style={{ gridColumn: "1 / -1" }}>
            ไม่มีสิทธิ์ = ไม่มีค่า แก้ไม่ได้ · แนะนำให้ใช้ 99 เป็นผู้ดูแลเหมือนระบบอื่น
          </span>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => {
          setRows((rs) => [...rs, { id: nextId, value: "", label: "", description: "" }]);
          setNextId((n) => n + 1);
        }}
      >
        ＋ เพิ่มระดับ
      </button>
    </div>
  );
}

"use client";

import { describeLevel, type Level } from "@/lib/systems";

/**
 * ตัวเลือกระดับ — เลือกจากระดับที่ลงทะเบียนเท่านั้น ห้ามพิมพ์ตัวเลข (spec 4.4)
 * ค่าที่ไม่ได้ลงทะเบียนแสดง "ค่าอื่น (n) — คงเดิม" และคงค่าเดิมจนกว่าจะเลือกใหม่
 * ระบบที่มีระดับเดียวแสดง "ไม่ใช่ผู้ดูแล / ผู้ดูแล" (design.md 5.13)
 */
export function LevelSelect({
  levels,
  original,
  value,
  onChange,
  label,
  disabled,
}: {
  levels: Level[];
  original: number | null;
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  disabled?: boolean;
}) {
  const other = describeLevel(levels, original).kind === "other" ? original : null;
  const single = levels.length === 1;
  return (
    <select
      className="input min-w-[220px]"
      aria-label={label}
      disabled={disabled}
      value={value === null ? "" : String(value)}
      style={describeLevel(levels, value).kind === "other" ? { borderColor: "#ffd23d88" } : undefined}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      <option value="">{single ? "ไม่ใช่ผู้ดูแล" : "ไม่มีสิทธิ์"}</option>
      {other !== null && <option value={other}>ค่าอื่น ({other}) — คงเดิม</option>}
      {levels.map((l) => (
        <option key={l.value} value={l.value}>
          {single && l.value === 99 ? "ผู้ดูแล" : l.label}
        </option>
      ))}
    </select>
  );
}

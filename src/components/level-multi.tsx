"use client";

import { describeLevel, levelSetText, type Level } from "@/lib/systems";
import { systemChipClass } from "./level-chip";

/**
 * ติ๊กบทบาท (ระบบหลายสิทธิ์, spec 2.3) — เลือกได้เฉพาะระดับที่ลงทะเบียน
 * ค่าที่ไม่อยู่ในทะเบียน (ค่าอื่น) แสดงไว้และติ๊กออกได้ แต่เพิ่มใหม่ไม่ได้
 */
export function LevelMultiSelect({
  levels,
  original,
  value,
  onChange,
  label,
}: {
  levels: Level[];
  original: readonly number[];
  value: readonly number[];
  onChange: (v: number[]) => void;
  label: string;
}) {
  const others = original.filter((v) => describeLevel(levels, v).kind === "other");
  const options = [...levels.map((l) => ({ value: l.value, text: l.label, other: false })), ...others.map((v) => ({ value: v, text: `ค่าอื่น (${v})`, other: true }))];
  const toggle = (v: number, on: boolean) => onChange(on ? [...new Set([...value, v])].sort((a, b) => a - b) : value.filter((x) => x !== v));
  return (
    <fieldset className="m-0 flex flex-wrap gap-x-3 gap-y-1 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className={`flex min-h-11 cursor-pointer items-center gap-2 text-sm ${o.other ? "text-warn-ink" : ""}`}>
          <input type="checkbox" className="check" checked={value.includes(o.value)} onChange={(e) => toggle(o.value, e.target.checked)} />
          {o.text}
        </label>
      ))}
    </fieldset>
  );
}

/** ป้ายของชุดบทบาท "ระบบ · A, B" */
export function LevelSetChip({
  levels,
  values,
  systemName,
  colorIndex = 0,
}: {
  levels: Level[];
  values: readonly number[];
  systemName?: string;
  colorIndex?: number;
}) {
  const prefix = systemName ? `${systemName} · ` : "";
  if (!values.length) return <span className="chip chip-off">{prefix}ไม่มีสิทธิ์</span>;
  const hasOther = values.some((v) => describeLevel(levels, v).kind === "other");
  return <span className={`chip ${hasOther ? "chip-warn" : systemChipClass(colorIndex)}`}>{hasOther ? "⚠ " : ""}{prefix}{levelSetText(levels, values)}</span>;
}

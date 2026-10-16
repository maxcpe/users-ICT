"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Level } from "@/lib/systems";

export type FilterSystem = { key: string; name: string; levels: Level[] };

const LINES = [
  ["", "ทุกสาย"],
  ["academic", "สายวิชาการ"],
  ["support", "สายสนับสนุน"],
] as const;
const STATUSES = [
  ["", "ทุกสถานะ"],
  ["active", "ใช้งาน"],
  ["inactive", "ปิดใช้งาน"],
  ["scheduled", "ตั้งปิดล่วงหน้า"],
] as const;

/** ตัวกรองหน้ารายชื่อ (spec 4.1) เก็บใน URL แชร์ลิงก์และกดย้อนกลับได้ */
export function PeopleFilters({ branches, jobs, systems }: { branches: string[]; jobs: string[]; systems: FilterSystem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();
  // มือถือยุบตัวกรองรองไว้ (ช่องค้นหาแสดงเสมอ) เปิดค้างถ้ามีตัวกรองที่ใช้อยู่
  const secondary = ["line", "branch", "job", "status", "sys", "incomplete"].filter((k) => params.get(k)).length;
  const [open, setOpen] = useState(secondary > 0);

  const get = (k: string) => params.get(k) ?? "";
  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page"); // เปลี่ยนตัวกรองแล้วกลับไปหน้าแรก
    next.delete("deleted");
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`));
  };

  const sys = systems.find((s) => s.key === get("sys"));
  const active = ["line", "branch", "job", "status", "sys", "incomplete"].filter((k) => get(k)).length + (get("q") ? 1 : 0);

  const select = (id: string, label: string, value: string, options: readonly (readonly [string, string])[], onChange: (v: string) => void, disabled = false) => (
    <div className="grid min-w-[150px] flex-1 gap-1">
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <div className="mb-3.5 grid gap-2.5" aria-busy={pending}>
      <form
        role="search"
        className="flex flex-wrap items-center gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() });
        }}
      >
        <label htmlFor="q" className="sr-only">ค้นหาชื่อหรืออีเมล</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} className="input flex-[1_1_240px] max-[820px]:basis-full" placeholder="ค้นหาชื่อหรืออีเมล…" />
        <button type="submit" className="btn max-[820px]:flex-1">ค้นหา</button>
        <button type="button" className="btn only-sm max-[820px]:flex-1" aria-expanded={open} aria-controls="people-more-filters" onClick={() => setOpen((v) => !v)}>
          ตัวกรอง{secondary ? ` (${secondary})` : ""} {open ? "▴" : "▾"}
        </button>
      </form>

      <div id="people-more-filters" className={`grid gap-2.5${open ? "" : " max-[820px]:hidden"}`}>
      <div className="flex flex-wrap items-end gap-2.5">
        {select("f-line", "สาย", get("line"), LINES, (v) => apply({ line: v }))}
        {select("f-branch", "สังกัด", get("branch"), [["", "ทุกสังกัด"], ...branches.map((b) => [b, b] as const)], (v) => apply({ branch: v }))}
        {select("f-job", "งาน", get("job"), [["", "ทุกงาน"], ...jobs.map((j) => [j, j] as const)], (v) => apply({ job: v }))}
        {select("f-status", "สถานะ", get("status"), STATUSES, (v) => apply({ status: v }))}
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        {select("f-sys", "สิทธิ์ของระบบ", get("sys"), [["", "ไม่กรองตามสิทธิ์"], ...systems.map((s) => [s.key, s.name] as const)], (v) =>
          apply({ sys: v, lv: v ? "any" : "" }),
        )}
        {select(
          "f-lv",
          "ระดับ",
          sys ? get("lv") || "any" : "",
          sys
            ? [["any", "มีสิทธิ์ (ทุกระดับ)"], ...sys.levels.map((l) => [String(l.value), `${l.label} (${l.value})`] as const), ["none", "ไม่มีสิทธิ์"]]
            : [["", "เลือกระบบก่อน"]],
          (v) => apply({ lv: v }),
          !sys,
        )}
        <label className="flex min-h-12 items-center gap-2.5 px-1">
          <input type="checkbox" className="check" checked={get("incomplete") === "1"} onChange={(e) => apply({ incomplete: e.target.checked ? "1" : "" })} />
          <span>⚠ ข้อมูลไม่ครบหรืออีเมลซ้ำ</span>
        </label>
        {active > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setQ("");
              start(() => router.replace(pathname));
            }}
          >
            ล้างตัวกรอง ({active})
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

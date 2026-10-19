"use client";

import { useState } from "react";
import { IconDown, IconUp } from "@/components/icons";

/**
 * ตัวกรองรอง (สาย สังกัด งาน) — คอมพิวเตอร์แสดงเสมอ มือถือยุบไว้ใต้ปุ่ม "ตัวกรอง (n)"
 * ใช้ display: contents ให้ช่องอยู่ใน flex ของฟอร์มเดิม (ฟอร์ม GET ยังส่งค่าครบแม้ยุบ เพราะแค่ซ่อนด้วย CSS)
 */
export function FilterDisclosure({ active, children }: { active: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(active > 0);
  return (
    <>
      <button
        type="button"
        className="btn only-sm"
        aria-expanded={open}
        aria-controls="more-filters"
        onClick={() => setOpen((v) => !v)}
      >
        ตัวกรอง{active ? ` (${active})` : ""} {open ? <IconUp /> : <IconDown />}
      </button>
      <div id="more-filters" className={open ? "contents" : "contents max-[820px]:[&>*]:hidden"}>
        {children}
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** แท็บเป็นลิงก์ไปเส้นทางย่อย กดย้อนกลับและแชร์ลิงก์ได้ (design.md 5.7) */
export function RouteTabs({ tabs, label }: { tabs: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  // แท็บที่ยาวที่สุดที่ตรงกับ path ปัจจุบันคือแท็บที่เลือก
  const current = [...tabs].sort((a, b) => b.href.length - a.href.length).find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
  return (
    <nav className="tabs mt-[18px] mb-[18px]" aria-label={label}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={current?.href === t.href ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

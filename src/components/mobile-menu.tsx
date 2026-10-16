"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavItem = { href: string; label: string };

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/u/") : pathname.startsWith(href);
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="nav-link" aria-current={isCurrent(pathname, i.href) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </>
  );
}

/** ต่ำกว่า 820px เมนูยุบเป็นปุ่ม Esc ปิดและคืน focus (design.md 5.6) */
export function MobileMenu({ items }: { items: NavItem[] }) {
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  // จำ path ตอนเปิด เปลี่ยนหน้าแล้วเมนูปิดเอง
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) =>
    setOpenOn((prev) => ((typeof v === "function" ? v(prev === pathname) : v) ? pathname : null));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative min-[821px]:hidden">
      <button
        ref={button}
        type="button"
        className="btn btn-sm"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
      >
        เมนู
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="เมนูหลัก" className="glass absolute right-0 top-12 z-20 grid min-w-56 gap-1 p-2" style={{ background: "var(--surface)" }}>
          <NavLinks items={items} />
        </nav>
      )}
    </div>
  );
}

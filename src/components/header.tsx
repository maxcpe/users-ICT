import Link from "next/link";
import { signOut } from "@/auth";
import type { Actor } from "@/lib/roles";
import { MobileMenu, NavLinks, type NavItem } from "./mobile-menu";

export function Header({ actor, systems }: { actor: Actor; systems: { key: string; name: string }[] }) {
  const central = actor.role === "central";
  const systemNames = systems.map((s) => s.name);
  // ผู้ดูแลระบบไปหน้าระบบของตัวเองได้จากเมนูเลย ถ้าดูแลหลายระบบรวมเป็นลิงก์เดียวไปหน้ารายการระบบ
  const systemLinks: NavItem[] =
    systems.length <= 2
      ? systems.map((s) => ({ href: `/systems/${s.key}/people`, label: s.name }))
      : [{ href: "/systems", label: `ระบบที่ดูแล (${systems.length})` }];
  // design.md 5.6: ผู้ดูแลกลางเห็นเมนูระบบ ผู้ดูแลระบบเห็นแค่บุคลากรและบันทึก
  const items: NavItem[] = central
    ? [
        { href: "/", label: "บุคลากร" },
        { href: "/systems", label: "ระบบและผู้ดูแล" },
        { href: "/audit", label: "บันทึกการใช้งาน" },
      ]
    : [
        { href: "/", label: "บุคลากร" },
        ...systemLinks,
        { href: "/audit", label: "บันทึกการใช้งาน" },
      ];
  const badge = central ? "🛡️ ผู้ดูแลกลาง" : `🔧 ผู้ดูแล${systemNames.length === 0 ? "ระบบ" : systemNames.length <= 2 ? systemNames.join(", ") : ` ${systemNames.length} ระบบ`}`;

  return (
    <header className="above mx-auto flex max-w-[1120px] items-center gap-3 p-4">
      <a href="#main" className="skip">ข้ามไปเนื้อหา</a>
      <Link href="/" className="logo" aria-label="หน้าแรก ระบบจัดการผู้ใช้">U</Link>
      <span className="font-bold">ระบบจัดการผู้ใช้</span>
      <nav aria-label="เมนูหลัก" className="ml-5 hidden gap-1 min-[821px]:flex">
        <NavLinks items={items} />
      </nav>
      <div className="ml-auto flex items-center gap-2.5 text-sm text-muted">
        <span className="hidden rounded-xl border border-line px-3 py-2 sm:inline-block" style={{ background: "var(--glass)" }}>
          {badge} · {actor.name}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="btn btn-sm">ออกจากระบบ</button>
        </form>
        <MobileMenu items={items} />
      </div>
    </header>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { RouteTabs } from "@/components/route-tabs";
import { requireActor } from "@/lib/access";
import { countHolders } from "@/lib/registry";
import { canViewSystem, isCentral } from "@/lib/roles";
import { getSystem } from "@/lib/system-repo";

export default async function SystemLayout({ children, params }: { children: React.ReactNode; params: Promise<{ key: string }> }) {
  const { key } = await params;
  const actor = await requireActor();
  const system = await getSystem(key);
  if (!system || !canViewSystem(actor, key)) notFound();

  const central = isCentral(actor);
  const holderCount = await countHolders(system);
  const base = `/systems/${key}`;
  const tabs = [
    { href: base, label: "ภาพรวม" },
    { href: `${base}/people`, label: `ผู้ใช้ (${holderCount.toLocaleString("th-TH")})` },
    ...(central ? [{ href: `${base}/levels`, label: "ระดับสิทธิ์" }] : []),
    { href: `${base}/connect`, label: "วิธีเชื่อมต่อ" },
    ...(central ? [{ href: `${base}/settings`, label: "ตั้งค่า" }] : []),
  ];

  // คำแรกปกติ คำหลังไล่สี เช่น "ระบบ" + "ลงเวลา" (design.md 3)
  const [first, ...rest] = system.name.startsWith("ระบบ") ? ["ระบบ", system.name.slice(4)] : ["", system.name];

  return (
    <>
      <Link href="/systems" className="mb-1 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted no-underline">
        ← {central ? "ระบบทั้งหมด" : "ระบบที่ดูแล"}
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="grid h-16 w-16 flex-none place-items-center rounded-[20px] border border-[#ffffff26] text-[32px]"
          style={{ background: "linear-gradient(135deg,#00e1ff33,#ff2bd633)" }}
          aria-hidden="true"
        >
          {system.icon ?? "📦"}
        </div>
        <div className="min-w-0">
          <h1 className="h1 !m-0 !text-[clamp(28px,5vw,40px)]">
            {first}
            <span className="text-gradient">{rest.join("")}</span>
          </h1>
          <div className="chips mt-1.5">
            {system.active ? <span className="chip chip-ok">● ใช้งาน</span> : <span className="chip chip-off">💤 ซ่อนจากหน้าจอ</span>}
            {system.unconfirmed && <span className="chip chip-warn">⚠ ระดับยังไม่ยืนยัน</span>}
            {system.url && (
              <a href={system.url} target="_blank" rel="noopener noreferrer" className="small !text-cyan-ink">
                {system.url.replace(/^https:\/\//, "")} ↗
              </a>
            )}
          </div>
        </div>
      </div>
      <RouteTabs tabs={tabs} label={`ส่วนของ${system.name}`} />
      {children}
    </>
  );
}

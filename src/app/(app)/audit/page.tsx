import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/pager";
import { AuditList } from "@/components/audit-list";
import { requireActor } from "@/lib/access";
import { queryAudit } from "@/lib/audit-query";
import { canViewSystem } from "@/lib/roles";
import { listSystems } from "@/lib/system-repo";

export const metadata: Metadata = { title: "บันทึกการใช้งาน" };

const ACTIONS = [
  ["", "ทุกการกระทำ"],
  ["user.create", "เพิ่มบุคลากร"],
  ["user.update", "แก้ข้อมูล"],
  ["user.deactivate", "ปิดใช้งาน"],
  ["user.reactivate", "เปิดใช้งานอีกครั้ง"],
  ["user.delete", "ลบแถว"],
  ["sensitive.view", "แสดงข้อมูลอ่อนไหว"],
  ["sensitive.update", "แก้ข้อมูลอ่อนไหว"],
  ["system.clear", "ล้างสิทธิ์ทั้งระบบ"],
  ["system.rename", "เปลี่ยน key"],
  ["role.set", "ตั้งสิทธิ์"],
  ["admin.assign", "แต่งตั้งผู้ดูแล"],
  ["admin.revoke", "ถอนผู้ดูแล"],
  ["system.create", "ลงทะเบียนระบบ"],
  ["system.update", "แก้ข้อมูลระบบ"],
  ["system.levels", "แก้ระดับสิทธิ์"],
] as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ system?: string; action?: string; page?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const action = ACTIONS.some(([v]) => v === sp.action) ? sp.action : "";
  const systems = (await listSystems({ includeInactive: true })).filter((s) => canViewSystem(actor, s.key));
  const systemKey = systems.some((s) => s.key === sp.system) ? sp.system : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { entries, names, systems: sysMap, pages, total } = await queryAudit(actor, {
    systemKey: systemKey || undefined,
    action: action || undefined,
    page,
  });
  const qs = (p: number) =>
    `/audit?${new URLSearchParams({ ...(systemKey ? { system: systemKey } : {}), ...(action ? { action } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <h1 className="h1">บันทึก<span className="text-gradient">การใช้งาน</span></h1>
      <p className="lead">ทุกการเปลี่ยนแปลง แก้หรือลบไม่ได้{actor.role === "system" ? " · ท่านเห็นเฉพาะระบบที่ดูแล" : ""}</p>

      <form className="mb-3.5 flex flex-wrap items-end gap-2.5">
        <div className="grid min-w-[180px] flex-1 gap-1.5 max-[820px]:basis-full">
          <label htmlFor="f-system" className="label">ระบบ</label>
          <select id="f-system" name="system" className="input" defaultValue={systemKey}>
            <option value="">ทุกระบบที่เห็นได้</option>
            {systems.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid min-w-[180px] flex-1 gap-1.5 max-[820px]:basis-full">
          <label htmlFor="f-action" className="label">การกระทำ</label>
          <select id="f-action" name="action" className="input" defaultValue={action}>
            {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <button type="submit" className="btn max-[820px]:flex-1">กรอง</button>
        {(systemKey || action) && <Link href="/audit" className="btn">ล้าง</Link>}
      </form>

      <AuditList entries={entries} names={names} systems={sysMap} />

      <Pager page={page} pages={pages} href={qs} total={total} unit="รายการ" />
    </>
  );
}

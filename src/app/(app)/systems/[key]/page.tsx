import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { AdminManager } from "@/components/admin-manager";
import { getStaffByIds, levelCounts } from "@/lib/registry";
import { canViewSystem, isCentral } from "@/lib/roles";
import { getSystem, listSystemAdmins } from "@/lib/system-repo";
import { USERS_SYSTEM_KEY } from "@/lib/systems";
import { initials } from "@/lib/text";

const dateFmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

export default async function SystemOverview({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const actor = await requireActor();
  const system = await getSystem(key);
  if (!system || !canViewSystem(actor, key)) notFound();

  const [counts, admins, recent] = await Promise.all([
    levelCounts(system),
    listSystemAdmins(key),
    prisma.auditLog.findMany({ where: { systemKey: key }, orderBy: { at: "desc" }, take: 5 }),
  ]);
  const names = new Map(
    (await getStaffByIds([...new Set([...admins.map((a) => a.userId), ...recent.map((r) => r.actorId), ...recent.flatMap((r) => (r.targetId ? [r.targetId] : []))])])).map(
      (p) => [p.id, p.name ?? ""],
    ),
  );

  // นับในฐาน (GROUP BY) รองรับคนจำนวนมาก
  const holderCount = [...counts.values()].reduce((a, b) => a + b, 0);
  const otherCount = [...counts].filter(([v]) => !system.levels.some((l) => l.value === v)).reduce((a, [, n]) => a + n, 0);
  const top = system.levels[system.levels.length - 1]?.value;
  const max = Math.max(1, ...counts.values());
  const pct = (n: number) => `${Math.max(n ? 2 : 0, Math.round((n / max) * 100))}%`;

  return (
    <>
      <div className="mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
        <div className="glass stat"><b className="glow-p">{holderCount.toLocaleString("th-TH")}</b>คนมีสิทธิ์</div>
        <div className="glass stat"><b>{top !== undefined ? (counts.get(top) ?? 0) : 0}</b>ระดับสูงสุด ({top ?? "—"})</div>
        <div className="glass stat"><b className="glow-c">{admins.length}</b>ผู้ดูแลที่ตั้งสิทธิ์ได้</div>
        <Link href={`/systems/${key}/people?level=other`} className="glass stat">
          <b className="!text-warn-ink">{otherCount}</b>ค่าไม่อยู่ในรายการ
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3.5">
        <section className="glass pad" aria-labelledby="by-level">
          <h2 id="by-level" className="h2">จำนวนคนตามระดับ</h2>
          {system.levels.length === 0 && <p className="small">ยังไม่ได้กำหนดระดับ</p>}
          {system.levels.map((l) => {
            const n = counts.get(l.value) ?? 0;
            return (
              <Link key={l.value} href={`/systems/${key}/people?level=${l.value}`} className="lvbar">
                <span>{l.label} <span className="small">({l.value})</span></span>
                <span className="track"><span className="fill block" style={{ width: pct(n) }} /></span>
                <b>{n}</b>
              </Link>
            );
          })}
          {otherCount > 0 && (
            <Link href={`/systems/${key}/people?level=other`} className="lvbar">
              <span className="text-warn-ink">ค่าอื่น</span>
              <span className="track"><span className="fill warn block" style={{ width: pct(otherCount) }} /></span>
              <b>{otherCount}</b>
            </Link>
          )}
          <p className="small mb-0 mt-2.5">กดแต่ละแถวเพื่อดูรายชื่อในระดับนั้น</p>
        </section>

        <div className="grid content-start gap-3.5">
          <section className="glass pad" aria-labelledby="admins">
            {isCentral(actor) && key !== USERS_SYSTEM_KEY ? (
              <AdminManager
                systemKey={key}
                systemName={system.name}
                admins={admins.map((a) => ({ id: a.userId, name: names.get(a.userId) ?? `U_id ${a.userId}`, email: null, since: dateFmt.format(a.assignedAt) }))}
              />
            ) : (
              <>
                <h2 id="admins" className="h2 !mb-1.5">ผู้ดูแลที่ตั้งสิทธิ์ได้</h2>
                {admins.length === 0 && <p className="small">ยังไม่มีผู้ดูแล</p>}
                {admins.map((a) => (
                  <div key={a.userId} className="person-row">
                    <div className="av" aria-hidden="true">{initials(names.get(a.userId) ?? "?")}</div>
                    <div className="flex-1">
                      <div className="name">{names.get(a.userId) ?? `U_id ${a.userId}`}</div>
                      <div className="sub">ตั้งเมื่อ {dateFmt.format(a.assignedAt)}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>

          <section className="glass pad" aria-labelledby="recent">
            <h2 id="recent" className="h2">เปลี่ยนแปลงล่าสุด</h2>
            {recent.length === 0 && <p className="small">ยังไม่มีการเปลี่ยนแปลงผ่านระบบนี้</p>}
            {recent.map((r) => (
              <div key={String(r.id)} className="person-row">
                <div className="flex-1 text-sm">
                  <b>{r.targetId ? (names.get(r.targetId) ?? `U_id ${r.targetId}`) : r.action}</b>
                  <div className="sub">
                    {dateFmt.format(r.at)} · โดย {names.get(r.actorId) ?? `U_id ${r.actorId}`}
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

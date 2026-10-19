import type { Metadata } from "next";
import Link from "next/link";
import { requireActor } from "@/lib/access";
import { getStaffByIds, levelCountsAll } from "@/lib/registry";
import { canViewSystem, isCentral } from "@/lib/roles";
import { listSystemAdmins, listSystems } from "@/lib/system-repo";
import { USERS_SYSTEM_KEY } from "@/lib/systems";
import { initials } from "@/lib/text";
import { IconAlert, IconGrid, IconList, IconMoon, IconPlus } from "@/components/icons";

export const metadata: Metadata = { title: "ระบบและผู้ดูแล" };

type Search = { q?: string; show?: string; view?: string };
type Show = "all" | "warn" | "hidden";

// แบบ A (เลือก 9 ต.ค. 2569): การ์ดละระบบ ไม่แสดงชื่อคอลัมน์ U_…
// รองรับระบบจำนวนมาก: ค้นหา กรอง สลับเป็นตารางย่อ และนับทุกระบบใน 2 query
export default async function SystemsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireActor();
  const central = isCentral(actor);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const show: Show = sp.show === "warn" || sp.show === "hidden" ? sp.show : "all";
  const view = sp.view === "list" ? "list" : "card";

  const systems = (await listSystems({ includeInactive: central })).filter((s) => s.key !== USERS_SYSTEM_KEY && canViewSystem(actor, s.key));
  const [admins, counts] = await Promise.all([listSystemAdmins(), levelCountsAll(systems)]);
  const people = central ? new Map((await getStaffByIds([...new Set(admins.map((a) => a.userId))])).map((p) => [p.id, p.name ?? ""])) : new Map<number, string>();

  const cards = systems.map((s) => {
    const mine = admins.filter((a) => a.systemKey === s.key);
    const byLevel = counts.get(s.key) ?? new Map<number, number>();
    const holderCount = [...byLevel.values()].reduce((a, b) => a + b, 0);
    const other = [...byLevel].filter(([v]) => !s.levels.some((l) => l.value === v)).reduce((a, [, n]) => a + n, 0);
    const warnings = [
      ...(mine.length === 0 ? ["ยังไม่มีผู้ดูแล"] : []),
      ...(s.unconfirmed ? ["ระดับยังไม่ยืนยัน"] : []),
      ...(other ? [`ค่าอื่น ${other} คน`] : []),
    ];
    return { s, mine, holderCount, warnings };
  });
  const needle = q.toLowerCase();
  const matchQ = cards.filter(({ s }) => !needle || `${s.name} ${s.key} ${s.note ?? ""} ${s.url ?? ""}`.toLowerCase().includes(needle));
  const tally = {
    all: matchQ.length,
    warn: matchQ.filter((c) => c.warnings.length > 0).length,
    hidden: matchQ.filter((c) => !c.s.active).length,
  };
  const shown = matchQ.filter((c) => (show === "warn" ? c.warnings.length > 0 : show === "hidden" ? !c.s.active : true));

  const href = (patch: Partial<Search>) => {
    const m = { q, show, view, ...patch };
    const next = new URLSearchParams();
    if (m.q) next.set("q", m.q);
    if (m.show && m.show !== "all") next.set("show", m.show);
    if (m.view === "list") next.set("view", "list");
    return `/systems${next.size ? `?${next}` : ""}`;
  };

  const avatars = (mine: typeof admins) =>
    central && mine.length > 0 ? (
      <span className="flex" aria-label={`ผู้ดูแล: ${mine.map((a) => people.get(a.userId) ?? "").join(", ")}`}>
        {mine.slice(0, 5).map((a, i) => (
          <span
            key={a.userId}
            title={people.get(a.userId) ?? `รหัส ${a.userId}`}
            className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold"
            style={{ background: "var(--glass-2)", border: "2px solid var(--surface)", marginLeft: i ? -7 : 0 }}
          >
            {initials(people.get(a.userId) ?? "?")}
          </span>
        ))}
        {mine.length > 5 && <span className="small ml-1 self-center">+{mine.length - 5}</span>}
      </span>
    ) : null;

  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2.5">
        <h1 className="h1">
          {central ? <>ระบบและผู้ดูแล</> : <>ระบบที่ดูแล</>}
        </h1>
        {central && <Link href="/systems/new" className="btn btn-primary"><IconPlus />ลงทะเบียนระบบ</Link>}
      </div>
      <p className="lead">{systems.length.toLocaleString("th-TH")} ระบบ{central ? "ที่ใช้ทะเบียนผู้ใช้ร่วมกัน" : "ที่ท่านตั้งสิทธิ์ได้"}</p>

      <form role="search" method="get" className="mb-2.5 flex flex-wrap items-end gap-2.5">
        {show !== "all" && <input type="hidden" name="show" value={show} />}
        {view === "list" && <input type="hidden" name="view" value="list" />}
        <div className="grid min-w-[220px] flex-1 gap-1">
          <label htmlFor="sys-q" className="label">ค้นหาระบบ</label>
          <input id="sys-q" name="q" className="input" defaultValue={q} placeholder="ชื่อ คีย์ หรือที่อยู่เว็บ…" />
        </div>
        <button type="submit" className="btn">ค้นหา</button>
        {q && <Link href={href({ q: "" })} className="btn">ล้าง</Link>}
      </form>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <nav className="flex flex-wrap gap-2.5" aria-label="กรองระบบ">
          <Link href={href({ show: "all" })} className="pill" aria-current={show === "all" ? "page" : undefined}>ทั้งหมด {tally.all}</Link>
          {tally.warn > 0 && (
            <Link href={href({ show: "warn" })} className="pill" aria-current={show === "warn" ? "page" : undefined}><IconAlert /> มีคำเตือน {tally.warn}</Link>
          )}
          {tally.hidden > 0 && (
            <Link href={href({ show: "hidden" })} className="pill" aria-current={show === "hidden" ? "page" : undefined}><IconMoon /> ซ่อนอยู่ {tally.hidden}</Link>
          )}
        </nav>
        <nav className="ml-auto flex gap-1.5" aria-label="รูปแบบการแสดง">
          <Link href={href({ view: "card" })} className="pill" aria-current={view === "card" ? "page" : undefined}><IconGrid />การ์ด</Link>
          <Link href={href({ view: "list" })} className="pill" aria-current={view === "list" ? "page" : undefined}><IconList />ตาราง</Link>
        </nav>
      </div>

      {shown.length === 0 && <div className="glass pad text-center text-muted">ไม่พบระบบที่ตรงกับตัวกรอง</div>}

      {shown.length > 0 && view === "list" && (
        <div className="glass table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">ระบบ</th>
                <th scope="col" className="text-right">คนมีสิทธิ์</th>
                <th scope="col" className="hide-sm text-right">ผู้ดูแล</th>
                <th scope="col" className="hide-sm">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ s, mine, holderCount, warnings }) => (
                <tr key={s.key} style={s.active ? undefined : { opacity: 0.6 }}>
                  <td>
                    <Link href={`/systems/${s.key}`} className="flex min-h-11 items-center gap-2.5 text-inherit no-underline">
                      <span aria-hidden="true" className="text-xl">{s.icon ?? "📦"}</span>
                      <span className="min-w-0">
                        <span className="name block">{s.name}</span>
                        <span className="sub block">{s.levels.map((l) => l.label).join(" · ")}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{holderCount.toLocaleString("th-TH")}</td>
                  <td className="hide-sm text-right tabular-nums">{mine.length}</td>
                  <td className="hide-sm">
                    <div className="chips">
                      {!s.active && <span className="chip chip-off"><IconMoon /> ซ่อน</span>}
                      {warnings.map((w) => <span key={w} className="chip chip-warn"><IconAlert /> {w}</span>)}
                      {s.active && warnings.length === 0 && <span className="chip chip-ok"><span className="dot" aria-hidden="true" />ปกติ</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shown.length > 0 && view === "card" && (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3.5 p-0">
          {shown.map(({ s, mine, holderCount, warnings }) => {
            const top = s.levels[s.levels.length - 1]?.value;
            return (
              <li key={s.key}>
                <Link
                  href={`/systems/${s.key}`}
                  className="glass grid h-full gap-3 p-[18px] text-inherit no-underline transition-colors hover:border-[color-mix(in_srgb,var(--pink)_40%,transparent)] hover:bg-[var(--glass-2)]"
                  style={s.active ? undefined : { opacity: 0.6 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-xl text-[22px]" style={{ background: "var(--glass-2)" }} aria-hidden="true">
                      {s.icon ?? "📦"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="m-0 text-[17px] font-semibold leading-snug">{s.name}</h2>
                      <div className="chips mt-0.5">
                        {s.storage === "table" && <span className="chip chip-violet">ระบบใหม่</span>}
                        {!s.active && <span className="chip chip-off"><IconMoon /> ซ่อนจากหน้าจอ</span>}
                      </div>
                    </div>
                    <span className="text-faint" aria-hidden="true">›</span>
                  </div>

                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl" style={{ background: "var(--line-2)" }}>
                    <div className="px-3 py-2" style={{ background: "var(--surface)" }}>
                      <b className="block text-xl font-semibold tabular-nums">{holderCount.toLocaleString("th-TH")}</b>
                      <span className="text-xs text-faint">คนมีสิทธิ์</span>
                    </div>
                    <div className="px-3 py-2" style={{ background: "var(--surface)" }}>
                      <b className="block text-xl font-semibold tabular-nums">{mine.length}</b>
                      <span className="text-xs text-faint">ผู้ดูแลที่ตั้งสิทธิ์ได้</span>
                    </div>
                  </div>

                  <div className="chips">
                    {s.levels.map((l) => (
                      <span key={l.value} className={`chip ${l.value === top ? "chip-pink" : "chip-off"}`}>{l.label}</span>
                    ))}
                    {warnings.map((w) => <span key={w} className="chip chip-warn"><IconAlert /> {w}</span>)}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="small">{s.note ?? " "}</span>
                    {avatars(mine)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

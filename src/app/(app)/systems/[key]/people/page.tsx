import Link from "next/link";
import { notFound } from "next/navigation";
import { Pager } from "@/components/pager";
import { SystemRoleEditor, type EditableRow, type PeopleFilter } from "@/components/system-role-editor";
import { requireActor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { dbNames } from "@/lib/env";
import { distinctValues, levelCounts, listHoldersPage, searchStaff, type StaffFilter, type SystemDef } from "@/lib/registry";
import { canSetRole, canViewSystem } from "@/lib/roles";
import { getSystem } from "@/lib/system-repo";
import { USERS_SYSTEM_KEY } from "@/lib/systems";
import { blankToNull } from "@/lib/text";

const PAGE_SIZE = 50;

type Search = { level?: string; q?: string; line?: string; branch?: string; job?: string; page?: string };
type LevelView = "all" | "other" | "none" | number;

const LINES = [
  ["", "ทุกสาย"],
  ["academic", "สายวิชาการ"],
  ["support", "สายสนับสนุน"],
] as const;

// แท็บผู้ใช้ (design.md 7): ตัวกรองชุดเดียวเหนือตาราง ใช้ทั้งคนที่มีสิทธิ์และ "ไม่มีสิทธิ์" (= ทางเพิ่มคน)
// ค้นหา กรอง และแบ่งหน้าที่ฐานข้อมูล (หน้าละ 50 คน)
export default async function SystemPeople({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Search> }) {
  const { key } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const system = await getSystem(key);
  if (!system || !canViewSystem(actor, key)) notFound();

  const canGrant = key !== USERS_SYSTEM_KEY;
  const levelParam = sp.level ?? "all";
  const parsed: LevelView =
    levelParam === "other" || levelParam === "none" ? levelParam : /^\d+$/.test(levelParam) ? Number(levelParam) : "all";
  const level: LevelView = parsed === "none" && !canGrant ? "all" : parsed;
  const filter: PeopleFilter = {
    q: (sp.q ?? "").trim().slice(0, 100),
    line: sp.line === "academic" || sp.line === "support" ? sp.line : "",
    branch: (sp.branch ?? "").trim(),
    job: (sp.job ?? "").trim(),
  };
  const staffFilter: StaffFilter = { line: filter.line || undefined, branch: filter.branch || undefined, job: filter.job || undefined };
  const requested = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [counts, branches, jobs, noneCount] = await Promise.all([
    levelCounts(system),
    distinctValues("U_branch"),
    distinctValues("U_job"),
    canGrant ? searchStaff({ q: "", withoutRoleIn: system, limit: 0 }).then((r) => r.total) : Promise.resolve(0),
  ]);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const countOf = (v: number) => counts.get(v) ?? 0;
  const otherCount = [...counts].filter(([v]) => !system.levels.some((l) => l.value === v)).reduce((a, [, n]) => a + n, 0);

  const fetchPage = (p: number) => loadPage(system, { q: filter.q, filter: staffFilter, level, offset: (p - 1) * PAGE_SIZE });
  const first = await fetchPage(requested);
  const pages = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  const { rows: found, total: matched } = page === requested ? first : await fetchPage(page);

  const ids = found.map((h) => h.id);
  const inactive = new Set(
    ids.length
      ? (await prisma.userStatus.findMany({ where: { status: "inactive", userId: { in: ids } }, select: { userId: true } })).map((r) => r.userId)
      : [],
  );
  const readOnly = dbNames().userDbReadOnly && system.storage === "column";
  const canEdit = canGrant && !readOnly;
  const filtered = !!(filter.q || filter.line || filter.branch || filter.job);

  const href = (patch: Partial<Search>) => {
    const m: Search = { level: levelParam, ...filter, ...patch };
    const next = new URLSearchParams();
    if (m.level && m.level !== "all") next.set("level", m.level);
    for (const k of ["q", "line", "branch", "job"] as const) if (m[k]) next.set(k, m[k]!);
    if (m.page && m.page !== "1") next.set("page", m.page);
    return `/systems/${key}/people${next.size ? `?${next}` : ""}`;
  };

  const rows: EditableRow[] = found.map((h) => ({
    id: h.id,
    name: h.name ?? "—",
    email: blankToNull(h.email),
    branch: blankToNull(h.branch),
    level: h.level,
    locked: readOnly
      ? "โหมดอ่านข้อมูลจริง"
      : inactive.has(h.id)
        ? "ปิดใช้งาน"
        : !canSetRole(actor, key, h.id)
          ? h.id === actor.userId
            ? "ท่าน"
            : "ตั้งผ่านการแต่งตั้งผู้ดูแล"
          : undefined,
  }));

  const pill = (view: string, text: string, current: boolean) => (
    <Link href={href({ level: view, page: "1" })} className="pill" aria-current={current ? "page" : undefined}>{text}</Link>
  );

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <nav className="flex flex-wrap gap-2.5" aria-label="กรองตามระดับ">
          {pill("all", `ทั้งหมด ${total.toLocaleString("th-TH")}`, level === "all")}
          {system.levels.map((l) => (
            <span key={l.value} className="contents">{pill(String(l.value), `${l.label} ${countOf(l.value).toLocaleString("th-TH")}`, level === l.value)}</span>
          ))}
          {otherCount > 0 && pill("other", `⚠ ค่าอื่น ${otherCount.toLocaleString("th-TH")}`, level === "other")}
          {canGrant && pill("none", `ไม่มีสิทธิ์ ${noneCount.toLocaleString("th-TH")}`, level === "none")}
        </nav>
        {canEdit && level !== "none" && (
          <Link href={href({ level: "none", page: "1" })} className="btn btn-primary ml-auto">＋ เพิ่มคน</Link>
        )}
      </div>

      {/* ฟอร์ม GET: ตัวกรองชุดเดียวของหน้า เปลี่ยนแล้วกลับไปหน้าแรก */}
      <form role="search" method="get" className="mb-3 flex flex-wrap items-end gap-2.5">
        {levelParam !== "all" && <input type="hidden" name="level" value={levelParam} />}
        <div className="grid min-w-[200px] flex-[2_1_200px] gap-1">
          <label htmlFor="t-q" className="label">ค้นหา</label>
          <input id="t-q" name="q" className="input" defaultValue={filter.q} placeholder="ชื่อหรืออีเมล…" />
        </div>
        <div className="grid min-w-[140px] flex-1 gap-1">
          <label htmlFor="t-line" className="label">สาย</label>
          <select id="t-line" name="line" className="input" defaultValue={filter.line}>
            {LINES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="grid min-w-[160px] flex-1 gap-1">
          <label htmlFor="t-branch" className="label">สังกัด</label>
          <select id="t-branch" name="branch" className="input" defaultValue={filter.branch}>
            <option value="">ทุกสังกัด</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="grid min-w-[160px] flex-1 gap-1">
          <label htmlFor="t-job" className="label">งาน</label>
          <select id="t-job" name="job" className="input" defaultValue={filter.job}>
            <option value="">ทุกงาน</option>
            {jobs.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <button type="submit" className="btn">กรอง</button>
        {filtered && <Link href={href({ q: "", line: "", branch: "", job: "", page: "1" })} className="btn">ล้าง</Link>}
      </form>

      <SystemRoleEditor
        system={{ key, name: system.name, note: system.note, levels: system.levels }}
        rows={rows}
        mode={level === "none" ? "none" : "holders"}
        matched={matched}
        filter={filter}
        canEdit={canEdit}
      />
      <Pager page={page} pages={pages} href={(p) => href({ page: String(p) })} total={matched} />
    </>
  );
}

type PageRow = { id: number; name: string | null; email: string | null; branch: string | null; level: number | null };

/** หนึ่งหน้าของตาราง: คนที่มีสิทธิ์ (ตามระดับ) หรือคนที่ยังไม่มีสิทธิ์ (level = none) */
async function loadPage(
  system: SystemDef,
  opts: { q: string; filter: StaffFilter; level: LevelView; offset: number },
): Promise<{ rows: PageRow[]; total: number }> {
  if (opts.level === "none") {
    const r = await searchStaff({ q: opts.q, withoutRoleIn: system, filter: opts.filter, limit: PAGE_SIZE, offset: opts.offset });
    return { rows: r.rows.map((x) => ({ ...x, level: null })), total: r.total };
  }
  return listHoldersPage(system, { q: opts.q, filter: opts.filter, level: opts.level, offset: opts.offset, limit: PAGE_SIZE });
}

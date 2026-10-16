import Link from "next/link";
import { notFound } from "next/navigation";
import { Pager } from "@/components/pager";
import { SystemRoleEditor, type EditableRow } from "@/components/system-role-editor";
import { requireActor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { dbNames } from "@/lib/env";
import { distinctValues, levelCounts, listHoldersPage, searchStaff, type SystemDef } from "@/lib/registry";
import { canSetRole, canViewSystem } from "@/lib/roles";
import { getSystem } from "@/lib/system-repo";
import { USERS_SYSTEM_KEY } from "@/lib/systems";
import { blankToNull } from "@/lib/text";

const PAGE_SIZE = 50;

type Search = { level?: string; q?: string; branch?: string; page?: string };

// ค้นหา กรอง และแบ่งหน้าที่ฐานข้อมูล (หน้าละ 50 คน) รองรับคนจำนวนมาก
export default async function SystemPeople({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Search> }) {
  const { key } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const system = await getSystem(key);
  if (!system || !canViewSystem(actor, key)) notFound();

  const levelParam = sp.level ?? "all";
  const level: "all" | "other" | "none" | number =
    levelParam === "other" || levelParam === "none" ? levelParam : /^\d+$/.test(levelParam) ? Number(levelParam) : "all";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const branch = (sp.branch ?? "").trim();
  const requested = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const canGrant = key !== USERS_SYSTEM_KEY;
  const [counts, branches, jobs, noneCount] = await Promise.all([
    levelCounts(system),
    distinctValues("U_branch"),
    distinctValues("U_job"),
    // คนที่ยังไม่มีสิทธิ์ (ให้ตั้งสิทธิ์จากตารางได้ และหาคนที่เพิ่งตั้งเป็น "ไม่มีสิทธิ์" เจอ)
    canGrant ? searchStaff({ q: "", withoutRoleIn: system, limit: 0 }).then((r) => r.total) : Promise.resolve(0),
  ]);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const countOf = (v: number) => counts.get(v) ?? 0;
  const otherCount = [...counts].filter(([v]) => !system.levels.some((l) => l.value === v)).reduce((a, [, n]) => a + n, 0);

  const fetchPage = (p: number) => loadPage(system, { q, branch, level: level === "none" && !canGrant ? "all" : level, offset: (p - 1) * PAGE_SIZE });
  const first = await fetchPage(requested);
  const pages = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  const { rows: holders, total: matched } = page === requested ? first : await fetchPage(page);

  const ids = holders.map((h) => h.id);
  const inactive = new Set(
    ids.length
      ? (await prisma.userStatus.findMany({ where: { status: "inactive", userId: { in: ids } }, select: { userId: true } })).map((r) => r.userId)
      : [],
  );
  const readOnly = dbNames().userDbReadOnly && system.storage === "column";

  const href = (patch: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged: Search = { level: levelParam, q, branch, ...patch };
    if (merged.level && merged.level !== "all") next.set("level", merged.level);
    if (merged.q) next.set("q", merged.q);
    if (merged.branch) next.set("branch", merged.branch);
    if (merged.page && merged.page !== "1") next.set("page", merged.page);
    return `/systems/${key}/people${next.size ? `?${next}` : ""}`;
  };

  const rows: EditableRow[] = holders.map((h) => ({
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

  return (
    <>
      <nav className="mb-3.5 flex flex-wrap gap-2.5" aria-label="กรองตามระดับ">
        <Link href={href({ level: "all" })} className="pill" aria-current={level === "all" ? "page" : undefined}>
          ทั้งหมด {total.toLocaleString("th-TH")}
        </Link>
        {system.levels.map((l) => (
          <Link key={l.value} href={href({ level: String(l.value) })} className="pill" aria-current={level === l.value ? "page" : undefined}>
            {l.label} {countOf(l.value).toLocaleString("th-TH")}
          </Link>
        ))}
        {canGrant && (
          <Link href={href({ level: "none" })} className="pill" aria-current={level === "none" ? "page" : undefined}>
            ไม่มีสิทธิ์ {noneCount.toLocaleString("th-TH")}
          </Link>
        )}
        {otherCount > 0 && (
          <Link href={href({ level: "other" })} className="pill" aria-current={level === "other" ? "page" : undefined}>
            ⚠ ค่าอื่น {otherCount.toLocaleString("th-TH")}
          </Link>
        )}
      </nav>

      {/* ฟอร์ม GET: ค้นหาและกรองที่ server เปลี่ยนตัวกรองแล้วกลับไปหน้าแรก */}
      <form role="search" method="get" className="mb-2.5 flex flex-wrap items-end gap-2.5">
        {levelParam !== "all" && <input type="hidden" name="level" value={levelParam} />}
        <div className="grid min-w-[220px] flex-[2_1_220px] gap-1">
          <label htmlFor="t-q" className="label">ค้นหาในรายชื่อ</label>
          <input id="t-q" name="q" className="input" defaultValue={q} placeholder="ชื่อหรืออีเมล…" />
        </div>
        <div className="grid min-w-[180px] flex-1 gap-1">
          <label htmlFor="t-branch" className="label">สังกัด</label>
          <select id="t-branch" name="branch" className="input" defaultValue={branch}>
            <option value="">ทุกสังกัด</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <button type="submit" className="btn">ค้นหา</button>
        {(q || branch) && <Link href={href({ q: "", branch: "" })} className="btn">ล้าง</Link>}
      </form>

      <SystemRoleEditor
        system={{ key, name: system.name, note: system.note, levels: system.levels }}
        rows={rows}
        canAdd={key !== USERS_SYSTEM_KEY && !readOnly}
        branches={branches}
        jobs={jobs}
      />
      <Pager page={page} pages={pages} href={(p) => href({ page: String(p) })} total={matched} />
    </>
  );
}

type PageRow = { id: number; name: string | null; email: string | null; branch: string | null; level: number | null };

/** หนึ่งหน้าของตาราง: คนที่มีสิทธิ์ (ตามระดับ) หรือคนที่ยังไม่มีสิทธิ์ (level = none) */
async function loadPage(
  system: SystemDef,
  opts: { q: string; branch: string; level: "all" | "other" | "none" | number; offset: number },
): Promise<{ rows: PageRow[]; total: number }> {
  if (opts.level === "none") {
    const r = await searchStaff({ q: opts.q, withoutRoleIn: system, filter: { branch: opts.branch || undefined }, limit: PAGE_SIZE, offset: opts.offset });
    return { rows: r.rows.map((x) => ({ ...x, level: null })), total: r.total };
  }
  return listHoldersPage(system, { q: opts.q, branch: opts.branch, level: opts.level, offset: opts.offset, limit: PAGE_SIZE });
}

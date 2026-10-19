import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/pager";
import { PeopleFilters } from "@/components/people-filters";
import { PeopleTable } from "@/components/people-table";
import { requireActor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { dbNames } from "@/lib/env";
import { countIncomplete, countStaff, distinctValues, duplicateEmails, listStaff, type StaffFilter } from "@/lib/registry";
import { canViewSystem, isCentral } from "@/lib/roles";
import { listSystems } from "@/lib/system-repo";
import { USERS_SYSTEM_KEY } from "@/lib/systems";
import { blankToNull } from "@/lib/text";
import { IconCheck, IconInfo, IconPlus } from "@/components/icons";

export const metadata: Metadata = { title: "บุคลากร" };

const PAGE_SIZE = 50; // spec 4.1

type Params = {
  q?: string;
  page?: string;
  deleted?: string;
  line?: string;
  branch?: string;
  job?: string;
  status?: string;
  sys?: string;
  lv?: string;
  incomplete?: string;
};

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await requireActor();
  const central = isCentral(actor);
  const sp = await searchParams;
  const { q = "", page: pageParam, deleted } = sp;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const all = await listSystems();
  const visible = all.filter((s) => s.key !== USERS_SYSTEM_KEY && canViewSystem(actor, s.key));
  const usersSystem = all.find((s) => s.key === USERS_SYSTEM_KEY);

  if (!central && visible.length === 0) {
    return (
      <>
        <h1 className="h1">บุคลากร</h1>
        <div className="callout callout-info mt-4">
          <IconInfo />
          <span>ท่านยังไม่ได้รับมอบหมายให้ดูแลระบบใด ติดต่อผู้ดูแลกลางเพื่อขอสิทธิ์</span>
        </div>
      </>
    );
  }

  const querySystems = central && usersSystem ? [...visible, usersSystem] : visible;
  const statusRows = await prisma.userStatus.findMany({ where: { status: { in: ["inactive", "scheduled"] } }, select: { userId: true, reason: true, status: true } });
  const inactiveRows = statusRows.filter((r) => r.status === "inactive");

  // ตัวกรอง (spec 4.1) — ระบบที่กรองได้คือระบบที่ผู้ใช้เห็นเท่านั้น
  const roleSystem = visible.find((s) => s.key === sp.sys);
  const lv = sp.lv === "none" || sp.lv === "any" ? sp.lv : Number.parseInt(sp.lv ?? "", 10);
  const filter: StaffFilter = {
    line: sp.line === "support" || sp.line === "academic" ? sp.line : undefined,
    branch: sp.branch || undefined,
    job: sp.job || undefined,
    incomplete: sp.incomplete === "1",
    role: roleSystem ? { system: roleSystem, level: typeof lv === "number" && Number.isFinite(lv) ? lv : lv === "none" ? "none" : "any" } : undefined,
    ...(sp.status === "active" ? { excludeIds: statusRows.filter((r) => r.status === "inactive").map((r) => r.userId) } : {}),
    ...(sp.status === "inactive" ? { onlyIds: inactiveRows.map((r) => r.userId) } : {}),
    ...(sp.status === "scheduled" ? { onlyIds: statusRows.filter((r) => r.status === "scheduled").map((r) => r.userId) } : {}),
  };

  const [{ rows, total }, dupes, staffTotal, incomplete, adminCount, branches, jobs] = await Promise.all([
    listStaff({ q, filter, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, systems: querySystems }),
    duplicateEmails(),
    central ? countStaff() : Promise.resolve(0),
    central ? countIncomplete() : Promise.resolve(0),
    central ? prisma.systemAdmin.groupBy({ by: ["userId"] }).then((g) => g.length) : Promise.resolve(0),
    distinctValues("U_branch"),
    distinctValues("U_job"),
  ]);
  const inactive = new Map(inactiveRows.map((r) => [r.userId, r.reason]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const keep = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "deleted")) as Record<string, string>;
  const qs = (p: number) => `/?${new URLSearchParams({ ...keep, ...(p > 1 ? { page: String(p) } : {}) })}`;
  const filtered = Object.keys(keep).length > 0;

  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2.5">
        <h1 className="h1">
          บุคลากร
          {central ? " ทั้งหมด" : ""}
        </h1>
        {central && !dbNames().userDbReadOnly && (
          <Link href="/u/new" className="btn btn-primary max-[820px]:w-full"><IconPlus />เพิ่มบุคลากร</Link>
        )}
      </div>
      {deleted && (
        <div className="callout callout-info mb-3.5" role="status">
          <IconCheck />
          <span>ลบแถวแล้ว ข้อมูลเดิมเก็บไว้ในบันทึกการใช้งาน</span>
        </div>
      )}
      <p className="lead">
        {central ? (
          "จัดการข้อมูลและสิทธิ์ของทุกระบบในคณะ"
        ) : (
          <>
            ท่านดูแล{" "}
            {visible.length <= 3 ? (
              <b className="text-white">{visible.map((s) => s.name).join(", ")}</b>
            ) : (
              <Link href="/systems" className="font-bold !text-white">{visible.length} ระบบ</Link>
            )}{" "}
            · ข้อมูลส่วนตัวแก้ได้ที่ผู้ดูแลกลาง
          </>
        )}
      </p>

      {central && (
        <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
          <Link href="/?status=active" className="glass stat"><b>{staffTotal - inactive.size}</b>ใช้งาน</Link>
          <Link href={usersSystem ? `/systems/${USERS_SYSTEM_KEY}/people` : "/"} className="glass stat"><b>{adminCount}</b>ผู้ดูแลระบบ</Link>
          <Link href="/?status=inactive" className="glass stat"><b>{inactive.size}</b>ปิดใช้งาน</Link>
          <Link href="/?incomplete=1" className="glass stat"><b className="!text-warn-ink">{incomplete + dupes.size}</b>ข้อมูลไม่ครบหรือซ้ำ</Link>
        </div>
      )}

      <PeopleFilters
        branches={branches}
        jobs={jobs}
        systems={visible.map((s) => ({ key: s.key, name: s.name, levels: s.levels }))}
      />

      {rows.length === 0 ? (
        <div className="glass pad text-center text-muted">
          {filtered ? "ไม่พบบุคลากรที่ตรงกับตัวกรอง ลองล้างตัวกรองบางข้อ" : "ยังไม่มีบุคลากรในทะเบียน"}
        </div>
      ) : (
        <PeopleTable
          selfId={actor.userId}
          systems={visible.map((s) => ({ key: s.key, name: s.name, note: s.note, levels: s.levels }))}
          bulkKeys={visible.filter((s) => !(dbNames().userDbReadOnly && s.storage === "column")).map((s) => s.key)}
          rows={rows.map((p) => ({
            id: p.id,
            name: p.name ?? "—",
            email: blankToNull(p.email),
            branch: blankToNull(p.branch),
            job: blankToNull(p.job),
            roles: p.roles,
            centralLevel: p.roles[USERS_SYSTEM_KEY] ?? null,
            inactiveReason: inactive.get(p.id) ?? null,
            flags: [
              ...(!blankToNull(p.email) ? ["ไม่มีอีเมล"] : []),
              ...(p.email !== null && dupes.has(p.email) ? ["อีเมลซ้ำ"] : []),
              ...(!blankToNull(p.position) ? ["ไม่มีตำแหน่ง"] : []),
            ],
          }))}
        />
      )}

      <Pager page={page} pages={pages} href={qs} total={total} unit={filtered ? "คน ที่ตรงกับตัวกรอง" : "คน"} />
    </>
  );
}

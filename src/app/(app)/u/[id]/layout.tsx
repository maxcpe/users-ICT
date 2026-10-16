import Link from "next/link";
import { PersonActions } from "@/components/person-actions";
import { RouteTabs } from "@/components/route-tabs";
import { dbNames } from "@/lib/env";
import { bangkokToday, deleteBlockers } from "@/lib/lifecycle-rules";
import { deleteFacts } from "@/lib/lifecycle-service";
import { loadPerson } from "@/lib/person";
import { prisma } from "@/lib/db";
import { getRolesOf } from "@/lib/registry";
import { isCentral } from "@/lib/roles";
import { listSystems } from "@/lib/system-repo";
import { describeLevel, USERS_SYSTEM_KEY } from "@/lib/systems";
import { blankToNull } from "@/lib/text";

export default async function PersonLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, person, status } = await loadPerson(id);
  const base = `/u/${person.id}`;
  const academic = person.branch !== "สำนักงานคณะ";
  const central = isCentral(actor);
  const state = status?.status ?? "active";

  // ข้อมูลสำหรับปุ่มปิด/เปิดใช้งานและลบ (ผู้ดูแลกลางเท่านั้น)
  let actions: React.ReactNode = null;
  if (central && !dbNames().userDbReadOnly) {
    const systems = (await listSystems({ includeInactive: true })).filter((s) => s.key !== USERS_SYSTEM_KEY);
    const byKey = new Map(systems.map((s) => [s.key, s]));
    const roles = await getRolesOf(person.id, systems);
    const line = (key: string, v: number) => {
      const s = byKey.get(key)!;
      const d = describeLevel(s.levels, v);
      return { key, name: s.name, label: d.kind === "known" ? d.label : `ค่าอื่น (${v})`, note: s.note };
    };
    const savedRaw = (status?.savedRoles ?? {}) as Record<string, unknown>;
    actions = (
      <PersonActions
        userId={person.id}
        name={person.name ?? "—"}
        email={blankToNull(person.email)}
        status={state}
        scheduledDate={state === "scheduled" && status ? status.effectiveDate.toISOString().slice(0, 10) : null}
        today={bangkokToday()}
        roles={Object.entries(roles).flatMap(([k, v]) => (v === null ? [] : [line(k, v)]))}
        saved={Object.entries(savedRaw).flatMap(([k, v]) => (typeof v === "number" && byKey.has(k) ? [line(k, v)] : []))}
        deleteBlockers={deleteBlockers(await deleteFacts(prisma, person.id))}
        isSelf={person.id === actor.userId}
      />
    );
  }

  return (
    <>
      <Link href="/" className="mb-1 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted no-underline">← กลับไปรายชื่อ</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="h1 !text-[clamp(26px,5vw,38px)]">{person.name ?? "—"}</h1>
          <div className="chips mb-1">
            {state === "inactive" && <span className="chip chip-off">💤 ปิดใช้งาน · {status?.reason}</span>}
            {state === "scheduled" && (
              <span className="chip chip-warn">⏳ จะปิดใช้งาน {status?.effectiveDate.toISOString().slice(0, 10)} · {status?.reason}</span>
            )}
            {state === "active" && <span className="chip chip-ok">● ใช้งาน</span>}
            <span className="chip chip-cyan">{academic ? "สายวิชาการ" : "สายสนับสนุน"}</span>
            <span className="small">
              {blankToNull(person.position) ?? "ไม่มีตำแหน่ง"} · {blankToNull(person.email) ?? "ไม่มีอีเมล"} · รหัส {person.id}
            </span>
          </div>
        </div>
        {actions}
      </div>
      <RouteTabs
        label={`ข้อมูลของ ${person.name ?? ""}`}
        tabs={[
          { href: base, label: "สิทธิ์" },
          { href: `${base}/info`, label: "ข้อมูลทั่วไป" },
          ...(central ? [{ href: `${base}/sensitive`, label: "ข้อมูลอ่อนไหว 🔒" }] : []),
          { href: `${base}/history`, label: "ประวัติ" },
        ]}
      />
      {children}
    </>
  );
}

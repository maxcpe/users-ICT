import type { Metadata } from "next";
import { PersonRoleEditor, type PersonSystemRow } from "@/components/person-role-editor";
import { dbNames } from "@/lib/env";
import { loadPerson } from "@/lib/person";
import { getRoleSetsOf } from "@/lib/registry";
import { canSetRole, canViewSystem } from "@/lib/roles";
import { listSystems } from "@/lib/system-repo";
import { USERS_SYSTEM_KEY } from "@/lib/systems";

export const metadata: Metadata = { title: "สิทธิ์รายคน" };

export default async function PersonRoles({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const { actor, person, status } = await loadPerson(id);
  const systems = (await listSystems()).filter((s) => s.key !== USERS_SYSTEM_KEY && canViewSystem(actor, s.key));
  const roles = await getRoleSetsOf(person.id, systems);
  const inactive = status?.status === "inactive";

  const rows: PersonSystemRow[] = systems.map((s) => ({
    key: s.key,
    name: s.name,
    icon: s.icon,
    note: s.note,
    levels: s.levels,
    unconfirmed: s.unconfirmed,
    current: roles[s.key]?.[0] ?? null,
    multi: s.multi,
    currentLevels: roles[s.key] ?? [],
    locked: dbNames().userDbReadOnly && s.storage === "column"
      ? "โหมดอ่านข้อมูลจริง"
      : inactive
      ? "ปิดใช้งานอยู่"
      : !canSetRole(actor, s.key, person.id)
        ? person.id === actor.userId
          ? "แก้สิทธิ์ตัวเองไม่ได้"
          : "ท่านไม่ได้ดูแลระบบนี้"
        : undefined,
  }));

  return (
    <>
      {created && (
        <div className="callout callout-info mb-3.5" role="status">
          <span aria-hidden="true">✓</span>
          <span>เพิ่มบุคลากรแล้ว ตั้งสิทธิ์ของแต่ละระบบต่อได้เลยด้านล่าง</span>
        </div>
      )}
      {inactive && (
        <div className="callout callout-warn mb-3.5">
          <span aria-hidden="true">⚠</span>
          <span>คนที่ปิดใช้งานตั้งสิทธิ์ไม่ได้ ต้องเปิดใช้งานอีกครั้งก่อน</span>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-muted">ท่านยังไม่ได้รับมอบหมายให้ดูแลระบบใด</p>
      ) : (
        <PersonRoleEditor userId={person.id} personName={person.name ?? ""} systems={rows} />
      )}
    </>
  );
}

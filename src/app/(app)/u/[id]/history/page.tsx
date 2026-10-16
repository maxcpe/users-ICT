import type { Metadata } from "next";
import { AuditList } from "@/components/audit-list";
import { queryAudit } from "@/lib/audit-query";
import { loadPerson } from "@/lib/person";

export const metadata: Metadata = { title: "ประวัติรายคน" };

export default async function PersonHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, person } = await loadPerson(id);
  const pageSize = 100;
  const { entries, names, systems, total } = await queryAudit(actor, { targetId: person.id, pageSize });
  return (
    <>
      <AuditList entries={entries} names={names} systems={systems} hideTarget />
      {total > pageSize && <p className="small mt-3 text-center">แสดง {pageSize} รายการล่าสุดจาก {total} รายการ</p>}
    </>
  );
}

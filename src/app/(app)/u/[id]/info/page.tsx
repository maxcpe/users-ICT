import type { Metadata } from "next";
import { StaffForm } from "@/components/staff-form";
import { dbNames } from "@/lib/env";
import { loadPerson } from "@/lib/person";
import { distinctValues } from "@/lib/registry";
import { isCentral } from "@/lib/roles";
import { blankToNull } from "@/lib/text";
import { editStaffAction } from "../../staff-actions";

export const metadata: Metadata = { title: "ข้อมูลทั่วไป" };

export default async function PersonInfo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, person } = await loadPerson(id);
  const show = (v: string | null) => blankToNull(v) ?? <span className="small">ไม่มีข้อมูล</span>;

  // ผู้ดูแลกลางแก้ได้ (spec 4.3) ผู้ดูแลระบบดูอย่างเดียว (spec 3.1)
  if (isCentral(actor) && !dbNames().userDbReadOnly) {
    const [branches, jobs] = await Promise.all([distinctValues("U_branch"), distinctValues("U_job")]);
    return (
      <div className="max-w-[760px]">
        <StaffForm
          action={editStaffAction.bind(null, person.id)}
          initial={{
            name: person.name ?? "",
            email: person.email ?? "",
            position: person.position ?? "",
            branch: person.branch ?? "",
            job: blankToNull(person.job) ?? "",
          }}
          branches={branches}
          jobs={jobs}
          submitLabel="บันทึก"
          cancelHref={`/u/${person.id}`}
          isEdit
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3.5">
      <section className="glass pad" aria-labelledby="general">
        <h2 id="general" className="h2">ข้อมูลทั่วไป</h2>
        <dl className="kv">
          <dt>ชื่อ–สกุล</dt><dd>{show(person.name)}</dd>
          <dt>อีเมล</dt><dd className="break-all">{show(person.email)}</dd>
          <dt>ตำแหน่ง</dt><dd>{show(person.position)}</dd>
          <dt>สังกัด</dt><dd>{show(person.branch)}</dd>
          <dt>งาน</dt><dd>{show(person.job)}</dd>
          <dt>รหัสผู้ใช้</dt><dd className="mono">U_id {person.id}</dd>
        </dl>
      </section>
      <div className="callout callout-info content-start">
        <span aria-hidden="true">ℹ️</span>
        <span>
          {isCentral(actor) ? "โหมดอ่านข้อมูลจริง แก้ข้อมูลไม่ได้" : "ถ้าชื่อ ตำแหน่ง หรืออีเมลผิด แจ้งผู้ดูแลกลาง"}
        </span>
      </div>
    </div>
  );
}

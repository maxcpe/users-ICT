import type { Metadata } from "next";
import Link from "next/link";
import { StaffForm } from "@/components/staff-form";
import { requireCentral } from "@/lib/access";
import { distinctValues } from "@/lib/registry";
import { createStaffAction } from "../staff-actions";

export const metadata: Metadata = { title: "เพิ่มบุคลากร" };

export default async function NewStaffPage() {
  await requireCentral();
  const [branches, jobs] = await Promise.all([distinctValues("U_branch"), distinctValues("U_job")]);
  return (
    <div className="mx-auto max-w-[760px]">
      <Link href="/" className="mb-1 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted no-underline">← กลับไปรายชื่อ</Link>
      <h1 className="h1"><span className="text-gradient">เพิ่ม</span>บุคลากร</h1>
      <p className="lead">เฉพาะบุคลากร ไม่รวมนักศึกษา · บันทึกแล้วไปตั้งสิทธิ์ต่อได้เลย</p>
      <StaffForm
        action={createStaffAction}
        initial={{ name: "", email: "", position: "", branch: "", job: "" }}
        branches={branches}
        jobs={jobs}
        submitLabel="เพิ่มบุคลากร"
        cancelHref="/"
        isEdit={false}
      />
    </div>
  );
}

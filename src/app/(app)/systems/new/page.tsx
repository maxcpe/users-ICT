import type { Metadata } from "next";
import Link from "next/link";
import { requireCentral } from "@/lib/access";
import { NewSystemForm } from "./new-system-form";

export const metadata: Metadata = { title: "ลงทะเบียนระบบใหม่" };

export default async function NewSystemPage() {
  await requireCentral();
  return (
    <div className="mx-auto max-w-[760px]">
      <Link href="/systems" className="mb-1 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted no-underline">← ระบบทั้งหมด</Link>
      <h1 className="h1">ลงทะเบียน<span className="text-gradient">ระบบใหม่</span></h1>
      <p className="lead">บันทึกแล้วใช้ได้ทันที ไม่ต้องแก้ตารางหรือรอผู้พัฒนา</p>
      <NewSystemForm />
    </div>
  );
}

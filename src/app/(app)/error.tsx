"use client";

import Link from "next/link";

// โหลดหน้าไม่สำเร็จ (เช่น ต่อฐานข้อมูลไม่ได้) — ไม่แสดงข้อความ error ดิบ (อาจมีรายละเอียดฐานข้อมูล)
// แสดงรหัสอ้างอิง (digest) ไว้แจ้งผู้ดูแลกลาง ซึ่งเทียบกับ log ของ server ได้
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid max-w-[640px] gap-3.5">
      <div className="callout callout-bad" role="alert">
        <span aria-hidden="true">⚠</span>
        <span>
          <b>โหลดหน้านี้ไม่สำเร็จ</b>
          <br />
          ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลกลางพร้อมรหัสอ้างอิงด้านล่าง ข้อมูลที่บันทึกไปแล้วไม่ได้หาย
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" className="btn btn-primary max-[820px]:flex-1" onClick={() => reset()}>ลองใหม่</button>
        <Link href="/" className="btn max-[820px]:flex-1">กลับไปรายชื่อ</Link>
      </div>
      {error.digest && <p className="small m-0">รหัสอ้างอิง: <span className="mono">{error.digest}</span></p>}
    </div>
  );
}

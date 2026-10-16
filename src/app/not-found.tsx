import Link from "next/link";

// spec 3.3: แถวนักศึกษา id ที่ไม่มี และหน้าที่ไม่มีสิทธิ์ ตอบหน้าเดียวกัน
export default function NotFound() {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-6">
      <div className="grid-bg" aria-hidden="true" />
      <main id="main" className="above text-center">
        <div className="big404" aria-hidden="true">404</div>
        <h1 className="h1 !text-[28px]">ไม่พบหน้านี้</h1>
        <p className="lead">หน้าอาจถูกย้าย หรือท่านไม่มีสิทธิ์เปิด</p>
        <Link href="/" className="btn btn-primary">กลับหน้ารายชื่อ</Link>
      </main>
    </div>
  );
}

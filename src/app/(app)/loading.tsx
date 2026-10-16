// ระหว่างโหลดหน้าในแอป (ทุกหน้าดึงข้อมูลที่ server) — นิ่ง ไม่เคลื่อนไหว (design.md 8, 10)
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="grid gap-3.5">
      <div className="h-10 w-48 rounded-[var(--r-md)]" style={{ background: "var(--glass-2)" }} aria-hidden="true" />
      <div className="glass pad grid gap-3" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 rounded-[var(--r-md)]" style={{ background: "var(--glass)" }} />
        ))}
      </div>
      <p className="small m-0">กำลังโหลด…</p>
    </div>
  );
}

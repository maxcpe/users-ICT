import Link from "next/link";

/** เลขหน้าที่จะแสดง: หน้าแรก หน้าสุดท้าย และรอบหน้าปัจจุบัน ที่เหลือเป็น "…" */
export function pageWindow(page: number, pages: number, radius = 1): (number | "…")[] {
  const out: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= radius) out.push(p);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

/** แบ่งหน้า (design.md 5.8) ใช้ลิงก์ กดย้อนกลับและแชร์ได้ */
export function Pager({ page, pages, href, total, unit = "คน" }: { page: number; pages: number; href: (p: number) => string; total: number; unit?: string }) {
  return (
    <>
      {pages > 1 && (
        <nav className="pager" aria-label="แบ่งหน้า">
          {page > 1 && <Link href={href(page - 1)} aria-label="หน้าก่อนหน้า">‹</Link>}
          {pageWindow(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} aria-hidden="true">…</span>
            ) : (
              <Link key={p} href={href(p)} aria-current={p === page ? "page" : undefined} aria-label={`หน้า ${p}`}>
                {p}
              </Link>
            ),
          )}
          {page < pages && <Link href={href(page + 1)} aria-label="หน้าถัดไป">›</Link>}
        </nav>
      )}
      <p className="small mt-3 text-center tabular-nums">
        {total.toLocaleString("th-TH")} {unit}
        {pages > 1 ? ` · หน้า ${page} จาก ${pages}` : ""}
      </p>
    </>
  );
}

// ตัวช่วยจัดรูปข้อความที่บันทึกลง `user`.`user` (utf8mb3)

/** อีเมลที่ใช้เทียบและบันทึก: ตัดช่องว่าง ตัวพิมพ์เล็ก (spec 4.2) */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** utf8mb3 เก็บอักขระ 4 ไบต์ (อีโมจิ) ไม่ได้ ต้องตรวจก่อนบันทึก (spec 2) */
export function hasFourByteChars(s: string): boolean {
  for (const ch of s) {
    if ((ch.codePointAt(0) ?? 0) > 0xffff) return true;
  }
  return false;
}

/** ค่าว่างในตารางเดิมมีทั้ง NULL, '' และ '-' ให้แสดงเหมือนกัน (spec 2) */
export function blankToNull(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t === "" || t === "-" ? null : t;
}

/** ใช้กับ LIKE: escape % _ \ ให้ค้นหาตามตัวอักษร */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** แถวนักศึกษาไม่แสดงในระบบนี้ (spec 3.3) */
export function isStudentPosition(position: string | null | undefined): boolean {
  return (position ?? "").startsWith("นักศึกษา");
}

/** อักษรย่อ 2 ตัวจากชื่อ (ตัดคำนำหน้า) สำหรับวงกลมรูปผู้ใช้ */
export function initials(name: string): string {
  const stripped = name
    .replace(/^(ผู้ช่วยศาสตราจารย์|รองศาสตราจารย์|ศาสตราจารย์|ผศ\.|รศ\.|ศ\.)\s*/, "")
    .replace(/^(ดร\.|ว่าที่ร้อยตรีหญิง|ว่าที่ร้อยตรี|นางสาว|นาย|นาง)\s*/, "")
    .trim();
  const parts = stripped.split(/\s+/).filter(Boolean);
  const first = firstConsonant(parts[0]) ?? "?";
  const second = firstConsonant(parts[1]) ?? "";
  return first + second;
}

// สระหน้า (เ แ โ ใ ไ) ไม่ใช่ตัวแรกที่ควรแสดง
function firstConsonant(word: string | undefined): string | undefined {
  if (!word) return undefined;
  for (const ch of word) {
    if (!"เแโใไ".includes(ch)) return ch;
  }
  return word[0];
}

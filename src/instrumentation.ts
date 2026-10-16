// ตอนเริ่ม server (spec 11.5)
// 1. ตรวจชื่อฐาน: โหมดพัฒนาที่ชี้ไปฐานจริงโดยไม่ได้ตั้งอ่านอย่างเดียวจะหยุดทันที
// 2. โหมดอ่านข้อมูลจริง: ถ้าบัญชีแก้ฐาน user ได้ (เช่น ictservice) เตือนว่าเหลือตัวกันชั้นโค้ดชั้นเดียว
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { dbNames, dangerousGrants } = await import("./lib/env");
  const names = dbNames();
  if (names.liveWrites) {
    console.warn(`คำเตือน: เครื่องพัฒนาเขียนฐาน ${names.userDb} จริง (ALLOW_PRODUCTION_WRITES=yes) ทุกการบันทึกมีผลกับเว็บอื่นทันที`);
    return;
  }
  if (!names.userDbReadOnly) return;

  const { prisma } = await import("./lib/db");
  const rows = await prisma.$queryRawUnsafe<Record<string, string>[]>("SHOW GRANTS");
  const bad = dangerousGrants(rows.flatMap((r) => Object.values(r)), names.userDb);
  console.warn(`โหมดอ่านข้อมูลจริง: ห้ามแก้ ${names.userDb}.user · ตารางของระบบนี้อยู่ที่ ${names.appDb} · user_roles อยู่ที่ ${names.rolesDb}`);
  if (bad.length) {
    console.warn(
      `คำเตือน: บัญชีใน DATABASE_URL แก้ฐาน ${names.userDb} ได้ การกันไม่ให้แก้ ${names.userDb}.user เหลือแค่ในโค้ด (ReadOnlyUserDbError)`,
    );
  }
}

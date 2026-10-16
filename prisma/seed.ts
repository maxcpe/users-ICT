// ค่าเริ่มต้นของฐาน usermanagement (spec 5.1, 11.2)
// - ทะเบียนระบบ: สร้างเฉพาะที่ยังไม่มี ไม่ทับค่าที่ผู้ดูแลกลางแก้ไว้
// - ผู้ดูแลของแต่ละระบบตอนเริ่ม: คนที่มีค่า 99 ในคอลัมน์ของระบบนั้น (คำตอบ 9 ต.ค. 2569)
// รันซ้ำได้ ไม่สร้างแถวซ้ำ

import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient, type Storage } from "../src/generated/prisma/client";
import { mariadbConfig } from "../src/lib/db-config";
import { resolveDbNames } from "../src/lib/env";
import { ROLE_COLUMN_RE, type Level } from "../src/lib/systems";

type Seed = {
  key: string;
  storage: Storage;
  columnName?: string;
  name: string;
  icon: string;
  url?: string;
  note?: string;
  levels: Level[];
  unconfirmed?: boolean;
  sortOrder: number;
};

const NEXT_LOGIN = "มีผลเมื่อเข้าสู่ระบบครั้งถัดไป";
const OPEN_TO_ALL = "ฝั่งผู้ใช้เปิดให้ทุกคนที่มีบัญชี 365";

const SYSTEMS: Seed[] = [
  { key: "evaluation", storage: "column", columnName: "U_evaluation", name: "ระบบประเมิน", icon: "📝", note: "มีผลทันที", sortOrder: 10,
    levels: [{ value: 1, label: "ผู้ใช้งาน" }, { value: 50, label: "เจ้าหน้าที่สร้างการประเมิน" }, { value: 80, label: "เจ้าหน้าที่ฝ่ายบุคคล" }, { value: 99, label: "ผู้ดูแล" }] },
  { key: "checkin", storage: "column", columnName: "U_checkin", name: "ระบบลงเวลา", icon: "⏰", note: NEXT_LOGIN, sortOrder: 20,
    levels: [{ value: 1, label: "ผู้ใช้งาน" }, { value: 90, label: "ผู้ใช้งานและผู้ดูแล" }, { value: 99, label: "ผู้ดูแล" }] },
  { key: "van", storage: "column", columnName: "U_van", name: "ระบบรถตู้", icon: "🚐", note: `${OPEN_TO_ALL} ระดับ "ผู้ใช้งาน" ไม่ได้ให้สิทธิ์เพิ่ม · ${NEXT_LOGIN}`, sortOrder: 30,
    levels: [{ value: 1, label: "ผู้ใช้งาน" }, { value: 99, label: "ผู้ดูแล" }] },
  { key: "meetingroom", storage: "column", columnName: "U_meetingroom", name: "จองห้องประชุม", icon: "🏢", note: `${OPEN_TO_ALL} ระดับ "ผู้ใช้งาน" ไม่ได้ให้สิทธิ์เพิ่ม · ${NEXT_LOGIN}`, sortOrder: 40,
    levels: [{ value: 1, label: "ผู้ใช้งาน" }, { value: 99, label: "ผู้ดูแล" }] },
  { key: "studyroom", storage: "column", columnName: "U_studyroom", name: "ห้องศึกษา", icon: "📚", note: `${OPEN_TO_ALL} · ${NEXT_LOGIN}`, sortOrder: 50,
    levels: [{ value: 99, label: "ผู้ดูแล" }] },
  { key: "register", storage: "column", columnName: "U_register", name: "ระบบลงทะเบียน", icon: "🎟️", unconfirmed: true, sortOrder: 60,
    levels: [{ value: 1, label: "ผู้ใช้งาน" }, { value: 90, label: "ระดับ 90" }] },
  { key: "projectday", storage: "column", columnName: "U_projectday", name: "Project Day", icon: "🏆", unconfirmed: true, sortOrder: 70,
    levels: [{ value: 1, label: "ผู้ใช้งาน" }, { value: 99, label: "ผู้ดูแล" }] },
  { key: "cultureexercise", storage: "column", columnName: "U_cultureexercise", name: "Culture Exercise", icon: "🎭", unconfirmed: true, sortOrder: 80,
    levels: [{ value: 1, label: "ผู้ใช้งาน" }, { value: 99, label: "ผู้ดูแล" }] },
  { key: "edpex", storage: "column", columnName: "U_edpex", name: "EdPEx", icon: "📊", unconfirmed: true, sortOrder: 90,
    levels: [{ value: 99, label: "ผู้ดูแล" }] },
  { key: "users", storage: "table", name: "ระบบจัดการผู้ใช้", icon: "🛡️", note: "มีผลทันที", sortOrder: 1000,
    levels: [{ value: 50, label: "ผู้ดูแลระบบ" }, { value: 99, label: "ผู้ดูแลกลาง" }] },
];

// ระบบสมมติสำหรับเครื่องพัฒนาเท่านั้น (ตรงกับแถว library ใน sql/dev-seed.sql)
const DEV_ONLY: Seed[] = [
  { key: "library", storage: "table", name: "ห้องสมุด", icon: "📖", url: "https://service.ict.up.ac.th/library", sortOrder: 100,
    levels: [{ value: 1, label: "ผู้ใช้งาน" }, { value: 99, label: "ผู้ดูแล" }] },
];

async function main() {
  const { userDb, rolesDb, userDbReadOnly } = resolveDbNames(process.env);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("ต้องตั้ง DATABASE_URL ใน .env");
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(mariadbConfig(url)) });
  // user_roles อยู่ฐานพัฒนาในโหมดอ่านข้อมูลจริง (env.ts)
  const T = (name: "user" | "user_roles") => Prisma.raw(`\`${name === "user" ? userDb : rolesDb}\`.\`${name}\``);

  try {
    const isDev = userDb.endsWith("_dev");
    if (userDbReadOnly) console.warn(`โหมดอ่านข้อมูลจริง: อ่าน ${userDb}.user, user_roles อยู่ที่ ${rolesDb}`);
    const all = [...SYSTEMS, ...(isDev ? DEV_ONLY : [])];

    for (const s of all) {
      await prisma.system.upsert({
        where: { key: s.key },
        create: { ...s, columnName: s.columnName ?? null, url: s.url ?? null, note: s.note ?? null, unconfirmed: s.unconfirmed ?? false },
        update: {},
      });
    }

    // ผู้ดูแลกลางที่ใช้เป็นผู้แต่งตั้งใน audit log
    const central = await prisma.$queryRaw<{ id: number }[]>`SELECT U_id AS id FROM ${T("user_roles")}
      WHERE system_key = 'users' AND level = 99 ORDER BY U_id LIMIT 1`;
    const actorId = central[0] ? Number(central[0].id) : null;
    if (actorId === null) {
      console.warn("ยังไม่มีผู้ดูแลกลาง (users = 99) ใน user_roles ข้ามการตั้งผู้ดูแลเริ่มต้น ดู spec 11.2");
      return;
    }

    const existing = await prisma.systemAdmin.count();
    if (existing > 0) {
      console.warn(`มีผู้ดูแลระบบอยู่แล้ว ${existing} แถว ไม่ตั้งค่าเริ่มต้นซ้ำ`);
      return;
    }

    let assigned = 0;
    for (const s of all) {
      if (s.key === "users") continue;
      let ids: { id: number }[];
      if (s.storage === "column") {
        if (!s.columnName || !ROLE_COLUMN_RE.test(s.columnName)) throw new Error(`คอลัมน์ไม่ถูกต้อง: ${s.key}`);
        const col = Prisma.raw(`\`${s.columnName}\``);
        ids = await prisma.$queryRaw`SELECT U_id AS id FROM ${T("user")} WHERE ${col} = 99
          AND (U_position IS NULL OR U_position NOT LIKE ${"นักศึกษา%"})`;
      } else {
        ids = await prisma.$queryRaw`SELECT U_id AS id FROM ${T("user_roles")} WHERE system_key = ${s.key} AND level = 99`;
      }
      for (const { id } of ids) {
        const userId = Number(id);
        await prisma.$transaction([
          prisma.systemAdmin.create({ data: { systemKey: s.key, userId, assignedBy: actorId } }),
          prisma.auditLog.create({
            data: { actorId, targetId: userId, systemKey: s.key, action: "admin.assign", changes: { source: "seed", rule: "level 99" } },
          }),
        ]);
        assigned++;
      }
    }

    // ผู้ดูแลระบบต้องมีระดับ 50 ในระบบ users จึงเข้าระบบนี้ได้ (spec 4.6) ไม่แตะคนที่เป็น 99
    const adminIds = [...new Set((await prisma.systemAdmin.findMany({ select: { userId: true } })).map((a) => a.userId))];
    for (const id of adminIds) {
      await prisma.$executeRaw`INSERT INTO ${T("user_roles")} (U_id, system_key, level) VALUES (${id}, 'users', 50)
        ON DUPLICATE KEY UPDATE level = level`;
    }
    console.warn(`ตั้งผู้ดูแลเริ่มต้น ${assigned} แถว (${adminIds.length} คน) ให้ผู้ดูแลกลางตรวจที่หน้า /systems`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

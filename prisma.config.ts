import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDbNames } from "./src/lib/env";

// `prisma generate` ไม่ต้องใช้ DATABASE_URL จึงใส่ datasource เฉพาะเมื่อมีค่า
// (migrate / db seed จะแจ้ง error เองถ้ายังไม่ได้ตั้ง .env)
const url = process.env.DATABASE_URL;

// กันพลาดก่อน migrate/seed: DATABASE_URL ต้องชี้ไปฐานเดียวกับ APP_DB และเครื่องพัฒนาต้องเป็น _dev (spec 11.5)
if (url) resolveDbNames(process.env);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(url ? { datasource: { url } } : {}),
});

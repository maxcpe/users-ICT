// ไม่ใส่ "server-only" ที่ไฟล์นี้ เพราะ instrumentation.ts ต้อง import ตอนเริ่ม server
// (Prisma ใช้ฝั่ง client ไม่ได้อยู่แล้ว ส่วน registry/access ยังกันด้วย server-only)
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { mariadbConfig } from "./db-config";
import { dbNames } from "./env";

const g = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  dbNames(); // กันซ้ำอีกชั้น เผื่อ instrumentation ไม่ได้รัน
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("ต้องตั้ง DATABASE_URL ใน .env");
  return new PrismaClient({ adapter: new PrismaMariaDb(mariadbConfig(url)) });
}

export const prisma = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

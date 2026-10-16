// ตั้งค่าการเชื่อมต่อ MariaDB/MySQL จาก DATABASE_URL (ใช้ทั้งแอปและ prisma/seed.ts)
//
// ต้องต่อแบบ TLS: MySQL 8.4 ใช้ caching_sha2_password ถ้าต่อแบบไม่เข้ารหัสและเซิร์ฟเวอร์ยังไม่ได้ cache รหัสไว้
// จะล็อกอินไม่ผ่าน ("RSA public key is not available") ทุก connection ที่ล้มถูกนับ จนเซิร์ฟเวอร์บล็อกเครื่อง
// (error 1129 เกิดจริง 9 ต.ค. 2569) — TLS ส่งรหัสผ่านแบบเข้ารหัสได้โดยไม่ต้องใช้ RSA key
//
// rejectUnauthorized: false เพราะเซิร์ฟเวอร์ใช้ใบรับรองที่ MySQL สร้างเอง (self-signed) ในวงแลนของคณะ

import type { PoolConfig } from "mariadb";

export function mariadbConfig(url: string): PoolConfig {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")) || undefined,
    ssl: { rejectUnauthorized: false },
    // pool เล็กพอสำหรับผู้ใช้ราว 20 คน และถ้าต่อไม่ได้จะไม่ยิง connection ที่ล้มรัวๆ
    connectionLimit: 5,
    connectTimeout: 10_000,
    acquireTimeout: 15_000,
  };
}

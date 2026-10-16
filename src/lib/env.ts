// ชื่อฐานข้อมูล (spec 11.5) และตัวกันไม่ให้เครื่องพัฒนาเขียนลงฐานจริง
// - APP_DB: ถ้าไม่ตั้ง ใช้ชื่อฐานใน DATABASE_URL (ตอนพัฒนาต้องลงท้าย _dev เสมอ)
// - USER_DB: ถ้าไม่ตั้ง ใช้ `user` ใน production และ `user_dev` ตอนพัฒนา
// - USER_DB_READONLY=yes (พัฒนาเท่านั้น): อ่านฐาน user จริงได้แต่เขียนไม่ได้
//   ตาราง user_roles ใช้ของฐาน APP_DB แทน เพื่อไม่ต้องสร้างอะไรในฐานจริง

const DB_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;

export type DbNames = {
  userDb: string;
  appDb: string;
  /** ฐานที่มีตาราง user_roles */
  rolesDb: string;
  /** ห้ามเขียน `user`.`user` (โหมดอ่านข้อมูลจริง) */
  userDbReadOnly: boolean;
  /** เครื่องพัฒนาเขียนฐาน user จริงได้ (ALLOW_PRODUCTION_WRITES=yes) — เตือนใน terminal ตอนเริ่ม (แถบบนหน้าจอเอาออกตามที่ผู้ใช้ขอ 9 ต.ค. 2569) */
  liveWrites: boolean;
};

export class EnvError extends Error {}

/** ตรวจชื่อฐาน แยกเป็นฟังก์ชันบริสุทธิ์เพื่อให้ทดสอบได้ */
export function resolveDbNames(env: Record<string, string | undefined>): DbNames {
  const prod = env.NODE_ENV === "production";
  const urlDb = env.DATABASE_URL !== undefined ? databaseFromUrl(env.DATABASE_URL) : null;
  const readOnly = env.USER_DB_READONLY === "yes";
  const allowWrites = env.ALLOW_PRODUCTION_WRITES === "yes";
  if (readOnly && allowWrites) {
    throw new EnvError("ตั้ง USER_DB_READONLY และ ALLOW_PRODUCTION_WRITES พร้อมกันไม่ได้ เลือกอย่างใดอย่างหนึ่ง");
  }

  const userDb = env.USER_DB || (prod ? "user" : "user_dev");
  const appDb = env.APP_DB || urlDb;
  if (!appDb) throw new EnvError("ต้องระบุชื่อฐานท้าย DATABASE_URL เช่น …:3306/usermanagement_dev");

  for (const [name, value] of [["USER_DB", userDb], ["APP_DB", appDb]] as const) {
    if (!DB_NAME_RE.test(value)) throw new EnvError(`${name} มีรูปแบบไม่ถูกต้อง`);
  }
  if (prod && (readOnly || allowWrites)) {
    throw new EnvError("USER_DB_READONLY / ALLOW_PRODUCTION_WRITES ใช้ได้เฉพาะตอนพัฒนา ห้ามตั้งใน production");
  }
  if (!prod) {
    if (userDb.endsWith("_dev")) {
      // พัฒนาบนฐานจำลองทั้งหมด
      if (!appDb.endsWith("_dev")) {
        throw new EnvError(`โหมดพัฒนา ฐานของระบบนี้ต้องลงท้ายด้วย _dev (spec 11.5) ตอนนี้: ${appDb}`);
      }
    } else {
      // ใช้ฐาน user จริง: ต้องเลือกให้ชัดว่าอ่านอย่างเดียว หรือยอมให้เขียนจริง
      // และตารางของระบบนี้อยู่ในฐานพัฒนาหรือในฐาน user เดียวกัน
      if (!readOnly && !allowWrites) {
        throw new EnvError(
          `โหมดพัฒนาห้ามใช้ฐาน ${userDb} จริงโดยไม่ระบุ ตั้ง USER_DB_READONLY=yes (อ่านอย่างเดียว) หรือ ALLOW_PRODUCTION_WRITES=yes (เขียนจริง) (spec 11.5)`,
        );
      }
      if (!appDb.endsWith("_dev") && appDb !== userDb) {
        throw new EnvError(`โหมดอ่านข้อมูลจริง ฐานของระบบนี้ต้องเป็น ${userDb} หรือลงท้ายด้วย _dev ตอนนี้: ${appDb}`);
      }
    }
  }
  if (env.DATABASE_URL !== undefined && urlDb !== appDb) {
    throw new EnvError(`ฐานใน DATABASE_URL (${urlDb ?? "ไม่ได้ระบุ"}) ต้องเป็นฐานเดียวกับ APP_DB (${appDb})`);
  }
  const userDbReadOnly = !prod && readOnly && !userDb.endsWith("_dev");
  // user_roles อยู่ในฐาน user เสมอ ยกเว้นโหมดอ่านข้อมูลจริงที่แยกตารางของระบบนี้ไว้ในฐาน _dev
  const rolesDb = userDbReadOnly && appDb !== userDb ? appDb : userDb;
  const liveWrites = !prod && allowWrites && !userDb.endsWith("_dev");
  return { userDb, appDb, rolesDb, userDbReadOnly, liveWrites };
}

/** ชื่อฐานจาก mysql://user:pass@host:port/<db>?… (ไม่คืนค่าอื่นของ URL) */
export function databaseFromUrl(url: string): string | null {
  try {
    const db = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
    return db === "" ? null : db;
  } catch {
    return null;
  }
}

/**
 * โหมดอ่านข้อมูลจริง: บัญชีที่ต่อฐานต้องแก้ฐาน user ไม่ได้เลย
 * รับผลของ SHOW GRANTS คืนบรรทัดที่อันตราย (ว่าง = ปลอดภัย)
 */
export function dangerousGrants(grants: string[], userDb: string): string[] {
  const writes = /\b(ALL PRIVILEGES|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|INDEX|REFERENCES|TRIGGER)\b/i;
  const target = new RegExp(`\\bON\\s+(\\*\\.\\*|\`?${userDb}\`?\\.)`, "i");
  return grants.filter((g) => {
    const privs = g.split(/\bON\b/i)[0] ?? "";
    return target.test(g) && writes.test(privs);
  });
}

let cached: DbNames | undefined;

export function dbNames(): DbNames {
  cached ??= resolveDbNames(process.env);
  return cached;
}

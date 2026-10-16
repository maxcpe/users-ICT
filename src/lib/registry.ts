import "server-only";
// ไฟล์เดียวที่มี raw SQL ต่อ `user`.`user` และ `user`.`user_roles` (spec 5, skill user-management-dev)
// - ระบุคอลัมน์ทุกครั้ง ห้าม SELECT * และห้ามอ่านคอลัมน์อ่อนไหวในรายชื่อ
// - ชื่อฐานมาจาก USER_DB (ผ่าน env.ts) ชื่อคอลัมน์สิทธิ์ต้องผ่าน allowlist ค่าอื่นเป็น parameter

import { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "./db";
import { dbNames } from "./env";
import { isAllowedRoleColumn, SYSTEM_KEY_RE, type Level } from "./systems";
import { escapeLike, normalizeEmail } from "./text";

export type SystemDef = {
  key: string;
  storage: "column" | "table";
  columnName: string | null;
  name: string;
  icon: string | null;
  url: string | null;
  note: string | null;
  levels: Level[];
  unconfirmed: boolean;
  active: boolean;
  sortOrder: number;
};

export type StaffRow = {
  id: number;
  name: string | null;
  email: string | null;
  position: string | null;
  job: string | null;
  branch: string | null;
};

export type StaffWithRoles = StaffRow & { roles: Record<string, number | null> };

type Db = typeof prisma | Tx;

// user_roles อยู่ในฐาน user ปกติ แต่โหมดอ่านข้อมูลจริงใช้ของฐานพัฒนาแทน (env.ts)
const table = (name: "user" | "user_roles") => {
  const { userDb, rolesDb } = dbNames();
  return Prisma.raw(`\`${name === "user" ? userDb : rolesDb}\`.\`${name}\``);
};

/** โหมดอ่านข้อมูลจริง: ห้ามเขียน `user`.`user` (spec 11.5) */
export class ReadOnlyUserDbError extends Error {
  constructor() {
    super("โหมดอ่านข้อมูลจริง: แก้ข้อมูลในตาราง user (รวมสิทธิ์ของระบบเดิม) ไม่ได้ระหว่างพัฒนา");
  }
}

function assertUserWritable() {
  if (dbNames().userDbReadOnly) throw new ReadOnlyUserDbError();
}

const NOT_STUDENT = Prisma.sql`(u.U_position IS NULL OR u.U_position NOT LIKE ${"นักศึกษา%"})`;

const STAFF_COLS = Prisma.sql`u.U_id AS id, u.U_name AS name, LOWER(TRIM(u.U_email)) AS email,
  u.U_position AS position, u.U_job AS job, u.U_branch AS branch`;

// ---------- allowlist คอลัมน์ (spec 7) ----------

let columnsCache: Promise<Set<string>> | undefined;

/** รายชื่อคอลัมน์จริงของ `user`.`user` อ่านครั้งเดียวต่อ process */
export function userColumns(): Promise<Set<string>> {
  columnsCache ??= prisma
    .$queryRaw<{ c: string }[]>`SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ${dbNames().userDb} AND TABLE_NAME = 'user'`
    .then((rows) => new Set(rows.map((r) => r.c)))
    .catch((e: unknown) => {
      columnsCache = undefined;
      throw e;
    });
  return columnsCache;
}

/** ชื่อคอลัมน์สิทธิ์ที่ผ่าน allowlist แล้ว (`u.` นำหน้าสำหรับ SELECT ที่ใช้ alias u) */
async function roleColumn(name: string, qualified = true): Promise<Prisma.Sql> {
  if (!isAllowedRoleColumn(name, await userColumns())) {
    throw new Error("คอลัมน์สิทธิ์ไม่อยู่ใน allowlist");
  }
  return Prisma.raw(qualified ? `u.\`${name}\`` : `\`${name}\``);
}

function keyAlias(key: string): Prisma.Sql {
  if (!SYSTEM_KEY_RE.test(key)) throw new Error("key ของระบบไม่ถูกต้อง");
  return Prisma.raw(`\`r_${key}\``);
}

const toNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

// ---------- ผู้ใช้ ----------

/** หาบุคลากรจากอีเมล (เทียบแบบตัดช่องว่าง ตัวพิมพ์เล็ก) อาจได้มากกว่า 1 แถวเพราะไม่มี unique index */
export async function findStaffByEmail(email: string): Promise<StaffRow[]> {
  return prisma.$queryRaw<StaffRow[]>`SELECT ${STAFF_COLS} FROM ${table("user")} u
    WHERE LOWER(TRIM(u.U_email)) = ${normalizeEmail(email)} AND ${NOT_STUDENT}`;
}

export async function getStaffByIds(ids: number[], db: Db = prisma): Promise<StaffRow[]> {
  if (ids.length === 0) return [];
  return db.$queryRaw<StaffRow[]>`SELECT ${STAFF_COLS} FROM ${table("user")} u
    WHERE u.U_id IN (${Prisma.join(ids)}) AND ${NOT_STUDENT}`;
}

/** ระดับในระบบ `users` (บทบาทในระบบนี้) */
export async function getUsersLevel(userId: number): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ level: number }[]>`SELECT level FROM ${table("user_roles")}
    WHERE U_id = ${userId} AND system_key = 'users'`;
  return toNum(rows[0]?.level);
}

export async function countStaff(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM ${table("user")} u WHERE ${NOT_STUDENT}`;
  return Number(rows[0]?.n ?? 0);
}

/** อีเมลที่ซ้ำกันมากกว่า 1 แถว (ตาราง user ไม่มี unique index — spec 2) */
export async function duplicateEmails(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ e: string }[]>`SELECT LOWER(TRIM(u.U_email)) AS e FROM ${table("user")} u
    WHERE ${NOT_STUDENT} AND u.U_email IS NOT NULL AND TRIM(u.U_email) <> ''
    GROUP BY LOWER(TRIM(u.U_email)) HAVING COUNT(*) > 1`;
  return new Set(rows.map((r) => r.e));
}

/** แถวที่ข้อมูลจำเป็นขาด: ไม่มีอีเมลหรือไม่มีตำแหน่ง (spec 4.1) */
export async function countIncomplete(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM ${table("user")} u WHERE ${NOT_STUDENT}
    AND (u.U_email IS NULL OR TRIM(u.U_email) = '' OR u.U_position IS NULL OR TRIM(u.U_position) = '')`;
  return Number(rows[0]?.n ?? 0);
}

/** รายชื่อบุคลากร (ไม่มีนักศึกษา ไม่มีคอลัมน์อ่อนไหว) พร้อมสิทธิ์ของระบบที่ส่งมา */
async function filterSql(f: StaffFilter | undefined): Promise<Prisma.Sql[]> {
  if (!f) return [];
  const out: Prisma.Sql[] = [];
  if (f.line === "support") out.push(Prisma.sql`TRIM(u.U_branch) = ${"สำนักงานคณะ"}`);
  if (f.line === "academic") out.push(Prisma.sql`(u.U_branch IS NULL OR TRIM(u.U_branch) <> ${"สำนักงานคณะ"})`);
  if (f.branch) out.push(Prisma.sql`TRIM(u.U_branch) = ${f.branch}`);
  if (f.job) out.push(Prisma.sql`TRIM(u.U_job) = ${f.job}`);
  if (f.onlyIds) out.push(f.onlyIds.length ? Prisma.sql`u.U_id IN (${Prisma.join(f.onlyIds)})` : Prisma.sql`FALSE`);
  if (f.excludeIds?.length) out.push(Prisma.sql`u.U_id NOT IN (${Prisma.join(f.excludeIds)})`);
  if (f.incomplete) {
    out.push(Prisma.sql`(u.U_email IS NULL OR TRIM(u.U_email) = '' OR u.U_position IS NULL OR TRIM(u.U_position) = ''
      OR LOWER(TRIM(u.U_email)) IN (SELECT e FROM (SELECT LOWER(TRIM(d.U_email)) AS e FROM ${table("user")} d
        WHERE d.U_email IS NOT NULL AND TRIM(d.U_email) <> '' GROUP BY LOWER(TRIM(d.U_email)) HAVING COUNT(*) > 1) dup))`);
  }
  if (f.role) {
    const { system, level } = f.role;
    if (system.storage === "column") {
      const c = await roleColumn(system.columnName ?? "");
      out.push(level === "any" ? Prisma.sql`${c} IS NOT NULL` : level === "none" ? Prisma.sql`${c} IS NULL` : Prisma.sql`${c} = ${level}`);
    } else {
      const exists = Prisma.sql`EXISTS (SELECT 1 FROM ${table("user_roles")} r WHERE r.U_id = u.U_id AND r.system_key = ${system.key}
        ${typeof level === "number" ? Prisma.sql`AND r.level = ${level}` : Prisma.empty})`;
      out.push(level === "none" ? Prisma.sql`NOT ${exists}` : exists);
    }
  }
  return out;
}

export type StaffFilter = {
  /** สาย: support = สำนักงานคณะ, academic = อื่นๆ (spec 2) */
  line?: "support" | "academic";
  branch?: string;
  job?: string;
  /** รายการ U_id ที่ต้องรวมเท่านั้น / ต้องตัดออก (ใช้กรองสถานะจาก user_status ซึ่งอยู่อีกตาราง) */
  onlyIds?: number[];
  excludeIds?: number[];
  /** สิทธิ์ของระบบหนึ่ง: any = มีสิทธิ์ระดับใดก็ได้, none = ไม่มีสิทธิ์, ตัวเลข = ระดับนั้น */
  role?: { system: SystemDef; level: "any" | "none" | number };
  /** ไม่มีอีเมล / ไม่มีตำแหน่ง / อีเมลซ้ำ */
  incomplete?: boolean;
};

export async function listStaff(opts: {
  q?: string;
  filter?: StaffFilter;
  offset: number;
  limit: number;
  systems: SystemDef[];
}): Promise<{ rows: StaffWithRoles[]; total: number }> {
  const where = [NOT_STUDENT];
  const q = opts.q?.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(Prisma.sql`(u.U_name LIKE ${like} OR u.U_email LIKE ${like})`);
  }
  where.push(...(await filterSql(opts.filter)));
  const whereSql = Prisma.join(where, " AND ");

  const columnSystems = opts.systems.filter((s) => s.storage === "column" && s.columnName);
  const extra = await Promise.all(
    columnSystems.map(async (s) => Prisma.sql`, ${await roleColumn(s.columnName!)} AS ${keyAlias(s.key)}`),
  );

  const [rows, count] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>`SELECT ${STAFF_COLS} ${Prisma.join(extra, " ")}
      FROM ${table("user")} u WHERE ${whereSql}
      ORDER BY u.U_name, u.U_id LIMIT ${opts.limit} OFFSET ${opts.offset}`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM ${table("user")} u WHERE ${whereSql}`,
  ]);

  const result: StaffWithRoles[] = rows.map((r) => {
    const roles: Record<string, number | null> = {};
    for (const s of columnSystems) roles[s.key] = toNum(r[`r_${s.key}`]);
    return {
      id: Number(r.id),
      name: (r.name as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      position: (r.position as string | null) ?? null,
      job: (r.job as string | null) ?? null,
      branch: (r.branch as string | null) ?? null,
      roles,
    };
  });

  const tableKeys = opts.systems.filter((s) => s.storage === "table").map((s) => s.key);
  if (result.length && tableKeys.length) {
    const ids = result.map((r) => r.id);
    const tr = await prisma.$queryRaw<{ id: number; k: string; level: number }[]>`
      SELECT U_id AS id, system_key AS k, level FROM ${table("user_roles")}
      WHERE U_id IN (${Prisma.join(ids)}) AND system_key IN (${Prisma.join(tableKeys)})`;
    const byId = new Map(result.map((r) => [r.id, r]));
    for (const row of result) for (const k of tableKeys) row.roles[k] = null;
    for (const t of tr) {
      const target = byId.get(Number(t.id));
      if (target) target.roles[t.k] = toNum(t.level);
    }
  }

  return { rows: result, total: Number(count[0]?.n ?? 0) };
}

// ---------- สิทธิ์ของระบบหนึ่ง ----------

export type Holder = StaffRow & { level: number };

/** ทุกคนที่มีค่าในระบบนี้ (ไม่มีนักศึกษา) */
export async function listHolders(system: SystemDef, db: Db = prisma): Promise<Holder[]> {
  let rows: (StaffRow & { level: unknown })[];
  if (system.storage === "column") {
    const c = await roleColumn(system.columnName ?? "");
    rows = await db.$queryRaw`SELECT ${STAFF_COLS}, ${c} AS level FROM ${table("user")} u
      WHERE ${c} IS NOT NULL AND ${NOT_STUDENT} ORDER BY u.U_name, u.U_id`;
  } else {
    rows = await db.$queryRaw`SELECT ${STAFF_COLS}, r.level AS level
      FROM ${table("user_roles")} r JOIN ${table("user")} u ON u.U_id = r.U_id
      WHERE r.system_key = ${system.key} AND ${NOT_STUDENT} ORDER BY u.U_name, u.U_id`;
  }
  return rows.map((r) => ({ ...r, id: Number(r.id), level: Number(r.level) }));
}

/** จำนวนคนต่อค่าระดับ นับในฐาน (GROUP BY) ไม่ดึงทุกแถว — ใช้กับกราฟ แท็บ และตรวจการแก้ระดับ */
export async function levelCounts(system: SystemDef, db: Db = prisma): Promise<Map<number, number>> {
  let rows: { v: unknown; n: bigint }[];
  if (system.storage === "column") {
    const c = await roleColumn(system.columnName ?? "");
    rows = await db.$queryRaw`SELECT ${c} AS v, COUNT(*) AS n FROM ${table("user")} u
      WHERE ${c} IS NOT NULL AND ${NOT_STUDENT} GROUP BY ${c}`;
  } else {
    rows = await db.$queryRaw`SELECT r.level AS v, COUNT(*) AS n FROM ${table("user_roles")} r
      JOIN ${table("user")} u ON u.U_id = r.U_id WHERE r.system_key = ${system.key} AND ${NOT_STUDENT} GROUP BY r.level`;
  }
  return new Map(rows.map((r) => [Number(r.v), Number(r.n)]));
}

/**
 * จำนวนคนต่อระดับของหลายระบบในครั้งเดียว (ระบบใหม่ 1 query, ระบบเดิม UNION ALL 1 query)
 * ใช้กับหน้ารายการระบบ จะได้ไม่ยิงฐานทีละระบบเมื่อมีระบบจำนวนมาก
 */
export async function levelCountsAll(systems: SystemDef[]): Promise<Map<string, Map<number, number>>> {
  const out = new Map<string, Map<number, number>>(systems.map((s) => [s.key, new Map()]));
  const add = (key: string, v: unknown, n: bigint) => out.get(key)?.set(Number(v), Number(n));

  const tableKeys = systems.filter((s) => s.storage === "table").map((s) => s.key);
  const columnSystems = systems.filter((s) => s.storage === "column" && s.columnName);
  const parts = await Promise.all(
    columnSystems.map(async (s) => {
      const c = await roleColumn(s.columnName!);
      return Prisma.sql`SELECT ${s.key} AS k, ${c} AS v, COUNT(*) AS n FROM ${table("user")} u
        WHERE ${c} IS NOT NULL AND ${NOT_STUDENT} GROUP BY ${c}`;
    }),
  );
  const [tableRows, columnRows] = await Promise.all([
    tableKeys.length
      ? prisma.$queryRaw<{ k: string; v: unknown; n: bigint }[]>`SELECT r.system_key AS k, r.level AS v, COUNT(*) AS n
          FROM ${table("user_roles")} r JOIN ${table("user")} u ON u.U_id = r.U_id
          WHERE r.system_key IN (${Prisma.join(tableKeys)}) AND ${NOT_STUDENT} GROUP BY r.system_key, r.level`
      : Promise.resolve([]),
    parts.length
      ? prisma.$queryRaw<{ k: string; v: unknown; n: bigint }[]>`${Prisma.join(parts, " UNION ALL ")}`
      : Promise.resolve([]),
  ]);
  for (const r of [...tableRows, ...columnRows]) add(r.k, r.v, r.n);
  return out;
}

export async function countHolders(system: SystemDef, db: Db = prisma): Promise<number> {
  let n = 0;
  for (const v of (await levelCounts(system, db)).values()) n += v;
  return n;
}

/**
 * คนที่มีสิทธิ์ในระบบหนึ่ง แบบแบ่งหน้า กรองที่ฐานข้อมูล (รองรับข้อมูลจำนวนมาก)
 * level: "all" | "other" (ค่าที่ไม่อยู่ในทะเบียน) | ตัวเลข
 */
export async function listHoldersPage(
  system: SystemDef,
  opts: { q?: string; branch?: string; level: "all" | "other" | number; offset: number; limit: number },
): Promise<{ rows: Holder[]; total: number }> {
  const where: Prisma.Sql[] = [NOT_STUDENT];
  const q = opts.q?.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(Prisma.sql`(u.U_name LIKE ${like} OR u.U_email LIKE ${like})`);
  }
  if (opts.branch) where.push(Prisma.sql`TRIM(u.U_branch) = ${opts.branch}`);

  let from: Prisma.Sql;
  let levelExpr: Prisma.Sql;
  if (system.storage === "column") {
    const c = await roleColumn(system.columnName ?? "");
    from = Prisma.sql`${table("user")} u`;
    levelExpr = c;
    where.push(Prisma.sql`${c} IS NOT NULL`);
  } else {
    from = Prisma.sql`${table("user_roles")} r JOIN ${table("user")} u ON u.U_id = r.U_id`;
    levelExpr = Prisma.sql`r.level`;
    where.push(Prisma.sql`r.system_key = ${system.key}`);
  }
  if (typeof opts.level === "number") where.push(Prisma.sql`${levelExpr} = ${opts.level}`);
  if (opts.level === "other") {
    const known = system.levels.map((l) => l.value);
    if (known.length) where.push(Prisma.sql`${levelExpr} NOT IN (${Prisma.join(known)})`);
  }
  const w = Prisma.join(where, " AND ");
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<(StaffRow & { level: unknown })[]>`SELECT ${STAFF_COLS}, ${levelExpr} AS level FROM ${from}
      WHERE ${w} ORDER BY u.U_name, u.U_id LIMIT ${opts.limit} OFFSET ${opts.offset}`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM ${from} WHERE ${w}`,
  ]);
  return { rows: rows.map((r) => ({ ...r, id: Number(r.id), level: Number(r.level) })), total: Number(count[0]?.n ?? 0) };
}

/**
 * ค้นหาบุคลากร (ชื่อ อีเมล หรือสังกัด) จำกัดจำนวน — ใช้กับช่องเพิ่มคนและแต่งตั้งผู้ดูแล
 * withoutRoleIn: ตัดคนที่มีสิทธิ์ในระบบนั้นอยู่แล้วออก
 */
export type StaffSearch = { q: string; withoutRoleIn?: SystemDef; filter?: StaffFilter };

async function searchWhere(opts: StaffSearch): Promise<Prisma.Sql> {
  const where: Prisma.Sql[] = [NOT_STUDENT];
  const q = opts.q.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(Prisma.sql`(u.U_name LIKE ${like} OR u.U_email LIKE ${like} OR u.U_branch LIKE ${like})`);
  }
  const s = opts.withoutRoleIn;
  if (s) {
    if (s.storage === "column") where.push(Prisma.sql`${await roleColumn(s.columnName ?? "")} IS NULL`);
    else where.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM ${table("user_roles")} r WHERE r.U_id = u.U_id AND r.system_key = ${s.key})`);
  }
  where.push(...(await filterSql(opts.filter)));
  return Prisma.join(where, " AND ");
}

/** ค้นหาพร้อมจำนวนทั้งหมดที่ตรง (rows จำกัดตาม limit, total นับในฐาน) */
export async function searchStaff(opts: StaffSearch & { limit: number; offset?: number }): Promise<{ rows: StaffRow[]; total: number }> {
  const w = await searchWhere(opts);
  const [rows, count] = await Promise.all([
    opts.limit > 0
      ? prisma.$queryRaw<StaffRow[]>`SELECT ${STAFF_COLS} FROM ${table("user")} u WHERE ${w}
          ORDER BY u.U_name, u.U_id LIMIT ${opts.limit} OFFSET ${opts.offset ?? 0}`
      : Promise.resolve([] as StaffRow[]),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM ${table("user")} u WHERE ${w}`,
  ]);
  return { rows: rows.map((r) => ({ ...r, id: Number(r.id) })), total: Number(count[0]?.n ?? 0) };
}

/** U_id ทุกคนที่ตรงเงื่อนไข (สำหรับ "เพิ่มทั้งหมด") ดึงไม่เกิน cap+1 เพื่อรู้ว่าเกินหรือไม่ */
export async function searchStaffIds(opts: StaffSearch, cap: number): Promise<number[]> {
  const w = await searchWhere(opts);
  const rows = await prisma.$queryRaw<{ id: unknown }[]>`SELECT u.U_id AS id FROM ${table("user")} u WHERE ${w} ORDER BY u.U_id LIMIT ${cap + 1}`;
  return rows.map((r) => Number(r.id));
}

// ---------- อ่าน/เขียนสิทธิ์ (ใช้ผ่าน role-service.ts เท่านั้น) ----------

/** ค่าสิทธิ์ปัจจุบันของคนหนึ่งในระบบหนึ่ง ล็อกแถวไว้จนจบ transaction (FOR UPDATE) */
export async function readRoleForUpdate(tx: Tx, system: SystemDef, userId: number): Promise<number | null> {
  if (system.storage === "column") {
    const c = await roleColumn(system.columnName ?? "");
    // โหมดอ่านข้อมูลจริงล็อกแถวไม่ได้ (ไม่มีสิทธิ์ UPDATE) และไม่ต้องล็อกเพราะเขียนไม่ได้อยู่แล้ว
    const lock = dbNames().userDbReadOnly ? Prisma.empty : Prisma.sql`FOR UPDATE`;
    const rows = await tx.$queryRaw<{ v: unknown }[]>`SELECT ${c} AS v FROM ${table("user")} u WHERE u.U_id = ${userId} ${lock}`;
    return toNum(rows[0]?.v);
  }
  const rows = await tx.$queryRaw<{ v: unknown }[]>`SELECT level AS v FROM ${table("user_roles")}
    WHERE U_id = ${userId} AND system_key = ${system.key} FOR UPDATE`;
  return toNum(rows[0]?.v);
}

/**
 * ตั้งสิทธิ์ (spec 4.4) — `null` = ไม่มีสิทธิ์
 * column: UPDATE คอลัมน์ (NULL = ไม่มีสิทธิ์) · table: upsert แถว (ไม่มีสิทธิ์ = ลบแถว)
 */
export async function writeRole(tx: Tx, system: SystemDef, userId: number, value: number | null): Promise<void> {
  if (system.storage === "column") {
    assertUserWritable();
    const col = await roleColumn(system.columnName ?? "", false);
    const affected = await tx.$executeRaw`UPDATE ${table("user")} SET ${col} = ${value} WHERE U_id = ${userId}`;
    if (affected > 1) throw new Error("ตั้งสิทธิ์กระทบมากกว่า 1 แถว");
    return;
  }
  if (value === null) {
    await tx.$executeRaw`DELETE FROM ${table("user_roles")} WHERE U_id = ${userId} AND system_key = ${system.key}`;
  } else {
    await tx.$executeRaw`INSERT INTO ${table("user_roles")} (U_id, system_key, level) VALUES (${userId}, ${system.key}, ${value})
      ON DUPLICATE KEY UPDATE level = VALUES(level)`;
  }
}

/** สิทธิ์ทุกระบบของคนหนึ่ง (ไม่ล็อกแถว) */
export async function getRolesOf(userId: number, systems: SystemDef[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  const cols = systems.filter((s) => s.storage === "column" && s.columnName);
  if (cols.length) {
    const sel = await Promise.all(cols.map(async (s) => Prisma.sql`${await roleColumn(s.columnName!)} AS ${keyAlias(s.key)}`));
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`SELECT ${Prisma.join(sel)} FROM ${table("user")} u WHERE u.U_id = ${userId}`;
    for (const s of cols) out[s.key] = toNum(rows[0]?.[`r_${s.key}`]);
  }
  const keys = systems.filter((s) => s.storage === "table").map((s) => s.key);
  for (const k of keys) out[k] = null;
  if (keys.length) {
    const rows = await prisma.$queryRaw<{ k: string; level: unknown }[]>`SELECT system_key AS k, level FROM ${table("user_roles")}
      WHERE U_id = ${userId} AND system_key IN (${Prisma.join(keys)})`;
    for (const r of rows) out[r.k] = toNum(r.level);
  }
  return out;
}

// ---------- เพิ่ม/แก้บุคลากร (spec 4.2, 4.3) ใช้ผ่าน staff-service.ts เท่านั้น ----------

type StaffColumn = "U_name" | "U_email" | "U_position" | "U_branch" | "U_job";
const STAFF_COLUMNS: ReadonlySet<StaffColumn> = new Set(["U_name", "U_email", "U_position", "U_branch", "U_job"]);
const staffCol = (c: StaffColumn) => {
  if (!STAFF_COLUMNS.has(c)) throw new Error("คอลัมน์ไม่อยู่ใน allowlist");
  return Prisma.raw(`\`${c}\``);
};

/** แถวที่ใช้อีเมลนี้อยู่ (ทุกแถว รวมนักศึกษา) เพื่อกันอีเมลซ้ำ — ตาราง user ไม่มี unique index */
export async function emailOwners(email: string, db: Db = prisma): Promise<{ id: number; name: string | null }[]> {
  const rows = await db.$queryRaw<{ id: number; name: string | null }[]>`SELECT U_id AS id, U_name AS name FROM ${table("user")}
    WHERE LOWER(TRIM(U_email)) = ${normalizeEmail(email)}`;
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

/** ค่าที่มีอยู่แล้วของสังกัด/งาน ใช้เป็นตัวเลือก ลดการสะกดต่างกัน (spec 4.2) */
export async function distinctValues(column: "U_branch" | "U_job"): Promise<string[]> {
  const c = staffCol(column);
  const rows = await prisma.$queryRaw<{ v: string }[]>`SELECT DISTINCT TRIM(u.${c}) AS v FROM ${table("user")} u
    WHERE u.${c} IS NOT NULL AND TRIM(u.${c}) NOT IN ('', '-') AND ${NOT_STUDENT} ORDER BY v`;
  return rows.map((r) => r.v);
}

/** ค่าปัจจุบันของข้อมูลทั่วไป (ล็อกแถว) */
export async function readStaffForUpdate(tx: Tx, userId: number): Promise<Record<StaffColumn, string | null> | null> {
  const rows = await tx.$queryRaw<Record<StaffColumn, string | null>[]>`SELECT U_name, U_email, U_position, U_branch, U_job
    FROM ${table("user")} u WHERE u.U_id = ${userId} AND ${NOT_STUDENT} FOR UPDATE`;
  return rows[0] ?? null;
}

/** เพิ่มแถวใหม่ คืน U_id ที่ฐานข้อมูลออกให้ */
export async function insertStaff(tx: Tx, v: Record<StaffColumn, string | null>): Promise<number> {
  assertUserWritable();
  await tx.$executeRaw`INSERT INTO ${table("user")} (U_name, U_email, U_position, U_branch, U_job)
    VALUES (${v.U_name}, ${v.U_email}, ${v.U_position}, ${v.U_branch}, ${v.U_job})`;
  const rows = await tx.$queryRaw<{ id: bigint }[]>`SELECT LAST_INSERT_ID() AS id`;
  const id = Number(rows[0]?.id ?? 0);
  if (!id) throw new Error("เพิ่มบุคลากรไม่สำเร็จ");
  return id;
}

/**
 * แก้ข้อมูลทั่วไป กันการเขียนทับ: WHERE ต้องตรงกับค่าเดิมทุกช่องที่แก้ (spec 4.3)
 * คืน false ถ้ามีคนแก้ก่อนแล้ว
 */
export async function updateStaff(
  tx: Tx,
  userId: number,
  changes: Partial<Record<StaffColumn, [string | null, string | null]>>,
): Promise<boolean> {
  assertUserWritable();
  const entries = Object.entries(changes) as [StaffColumn, [string | null, string | null]][];
  if (entries.length === 0) return true;
  const sets = entries.map(([c, [, next]]) => Prisma.sql`${staffCol(c)} = ${next}`);
  const guards = entries.map(([c, [prev]]) => Prisma.sql`${staffCol(c)} <=> ${prev}`);
  const affected = await tx.$executeRaw`UPDATE ${table("user")} SET ${Prisma.join(sets)}
    WHERE U_id = ${userId} AND ${Prisma.join(guards, " AND ")}`;
  if (affected > 1) throw new Error("แก้ข้อมูลกระทบมากกว่า 1 แถว");
  return affected === 1;
}

// ---------- ปิดใช้งาน / ลบ / ล้างสิทธิ์ (spec 4.5, 4.5.1, 4.6.1) ใช้ผ่าน lifecycle-service.ts เท่านั้น ----------

/** คอลัมน์ U_xxx ที่ไม่ใช่สิทธิ์ */
const NON_ROLE_COLUMNS: ReadonlySet<string> = new Set([
  "U_id", "U_name", "U_email", "U_idcard_hmac", "U_rfid", "U_tel", "U_position", "U_job", "U_branch",
]);

/** ทุกคอลัมน์สิทธิ์ในตาราง user รวมคอลัมน์ที่ไม่อยู่ในทะเบียนระบบ (spec 4.5.1 ข้อ 3) */
export async function allRoleColumns(): Promise<string[]> {
  return [...(await userColumns())].filter((c) => /^U_[a-z]+$/.test(c) && !NON_ROLE_COLUMNS.has(c)).sort();
}

/** คอลัมน์สิทธิ์ที่ยังมีค่าของคนหนึ่ง */
export async function nonNullRoleColumns(db: Db, userId: number): Promise<string[]> {
  const cols = await allRoleColumns();
  if (!cols.length) return [];
  const sel = await Promise.all(cols.map(async (c) => Prisma.sql`${await roleColumn(c)} AS ${Prisma.raw(`\`${c}\``)}`));
  const rows = await db.$queryRaw<Record<string, unknown>[]>`SELECT ${Prisma.join(sel)} FROM ${table("user")} u WHERE u.U_id = ${userId}`;
  const row = rows[0] ?? {};
  return cols.filter((c) => row[c] !== null && row[c] !== undefined);
}

export async function countTableRoles(db: Db, userId: number): Promise<number> {
  const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM ${table("user_roles")} WHERE U_id = ${userId}`;
  return Number(rows[0]?.n ?? 0);
}

/**
 * ลบแถวที่เพิ่มผิด — เงื่อนไขอยู่ใน WHERE ด้วย (สิทธิ์ทุกคอลัมน์ IS NULL และไม่มีแถวใน user_roles)
 * คืนจำนวนแถวที่ลบ ผู้เรียกต้อง rollback ถ้าไม่ใช่ 1
 */
export async function deleteStaffRow(tx: Tx, userId: number): Promise<number> {
  assertUserWritable();
  const cols = await allRoleColumns();
  const nulls = await Promise.all(cols.map(async (c) => Prisma.sql`${await roleColumn(c, false)} IS NULL`));
  return tx.$executeRaw`DELETE FROM ${table("user")} WHERE U_id = ${userId}
    ${nulls.length ? Prisma.sql`AND ${Prisma.join(nulls, " AND ")}` : Prisma.empty}
    AND NOT EXISTS (SELECT 1 FROM ${table("user_roles")} r WHERE r.U_id = ${userId})`;
}

/** ล้างสิทธิ์ของระบบหนึ่งทุกคน คืนจำนวนแถวที่เปลี่ยน */
export async function clearSystemRoles(tx: Tx, system: SystemDef): Promise<number> {
  if (system.storage === "column") {
    assertUserWritable();
    const col = await roleColumn(system.columnName ?? "", false);
    return tx.$executeRaw`UPDATE ${table("user")} SET ${col} = NULL WHERE ${col} IS NOT NULL`;
  }
  return tx.$executeRaw`DELETE FROM ${table("user_roles")} WHERE system_key = ${system.key}`;
}

// ---------- ข้อมูลอ่อนไหว (spec 6) อ่านเฉพาะหน้ารายคนของผู้ดูแลกลาง ----------

export type Sensitive = { rfid: string | null; tel: string | null; hasIdcard: boolean };

export async function readSensitive(userId: number): Promise<Sensitive | null> {
  const rows = await prisma.$queryRaw<{ rfid: string | null; tel: string | null; idc: bigint | number }[]>`
    SELECT u.U_rfid AS rfid, u.U_tel AS tel, (u.U_idcard_hmac IS NOT NULL AND u.U_idcard_hmac <> '') AS idc
    FROM ${table("user")} u WHERE u.U_id = ${userId} AND ${NOT_STUDENT}`;
  const r = rows[0];
  if (!r) return null;
  const clean = (v: string | null) => {
    const t = v?.trim();
    return t && t !== "-" ? t : null;
  };
  return { rfid: clean(r.rfid), tel: clean(r.tel), hasIdcard: Number(r.idc) === 1 };
}

/** แถวอื่นที่ใช้ RFID นี้ (RFID ต้องไม่ซ้ำ spec 6.2) */
export async function rfidOwners(db: Db, rfid: string, excludeId: number): Promise<number[]> {
  const rows = await db.$queryRaw<{ id: number }[]>`SELECT U_id AS id FROM ${table("user")}
    WHERE TRIM(U_rfid) = ${rfid.trim()} AND U_id <> ${excludeId}`;
  return rows.map((r) => Number(r.id));
}

export async function writeSensitive(
  tx: Tx,
  userId: number,
  column: "U_rfid" | "U_tel" | "U_idcard_hmac",
  value: string | null,
): Promise<void> {
  assertUserWritable();
  const col = Prisma.raw(column === "U_rfid" ? "`U_rfid`" : column === "U_tel" ? "`U_tel`" : "`U_idcard_hmac`");
  await tx.$executeRaw`UPDATE ${table("user")} SET ${col} = ${value} WHERE U_id = ${userId}`;
}

/** ย้ายสิทธิ์ใน user_roles จาก key เดิมไป key ใหม่ (ใช้ตอนเปลี่ยน key ของระบบ) */
export async function renameRolesKey(tx: Tx, oldKey: string, newKey: string): Promise<number> {
  if (!SYSTEM_KEY_RE.test(oldKey) || !SYSTEM_KEY_RE.test(newKey)) throw new Error("key ของระบบไม่ถูกต้อง");
  return tx.$executeRaw`UPDATE ${table("user_roles")} SET system_key = ${newKey} WHERE system_key = ${oldKey}`;
}

/** HMAC เลขบัตรที่เก็บไว้ (ใช้ตรวจคีย์เท่านั้น ห้ามส่งไปหน้าจอ) */
export async function readIdcardHmac(userId: number): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ h: string | null }[]>`SELECT u.U_idcard_hmac AS h FROM ${table("user")} u
    WHERE u.U_id = ${userId} AND ${NOT_STUDENT}`;
  const h = rows[0]?.h?.trim();
  return h ? h : null;
}

/** แถวอื่นที่มี HMAC เดียวกัน (spec 6.1 ตรวจซ้ำ) */
export async function idcardOwners(db: Db, hmac: string, excludeId: number): Promise<number[]> {
  const rows = await db.$queryRaw<{ id: number }[]>`SELECT U_id AS id FROM ${table("user")}
    WHERE U_idcard_hmac = ${hmac} AND U_id <> ${excludeId}`;
  return rows.map((r) => Number(r.id));
}

import "server-only";
import { cache } from "react";
import type { System } from "@/generated/prisma/client";
import { prisma } from "./db";
import type { SystemDef } from "./registry";
import { parseLevels } from "./systems";

export function toSystemDef(s: System): SystemDef {
  return {
    key: s.key,
    storage: s.storage,
    columnName: s.columnName,
    name: s.name,
    icon: s.icon,
    url: s.url,
    note: s.note,
    levels: parseLevels(s.levels),
    unconfirmed: s.unconfirmed,
    active: s.active,
    sortOrder: s.sortOrder,
  };
}

/** ทะเบียนระบบทั้งหมด เรียงตาม sort_order (cache ต่อ request) */
export const listSystems = cache(async (opts?: { includeInactive?: boolean }): Promise<SystemDef[]> => {
  const rows = await prisma.system.findMany({
    where: opts?.includeInactive ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
  });
  return rows.map(toSystemDef);
});

export const getSystem = cache(async (key: string): Promise<SystemDef | null> => {
  const row = await prisma.system.findUnique({ where: { key } });
  return row ? toSystemDef(row) : null;
});

export const listSystemAdmins = cache(async (key?: string) =>
  prisma.systemAdmin.findMany({ where: key ? { systemKey: key } : undefined, orderBy: { assignedAt: "asc" } }),
);

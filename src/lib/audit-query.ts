import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { getStaffByIds } from "./registry";
import { isCentral, type Actor } from "./roles";
import { listSystems } from "./system-repo";

/**
 * อ่าน audit log ตามสิทธิ์ (spec 4.7): ผู้ดูแลกลางเห็นทั้งหมด ผู้ดูแลระบบเห็นเฉพาะระบบที่ตนดูแล
 */
export async function queryAudit(
  actor: Actor,
  filter: { targetId?: number; systemKey?: string; action?: string; page?: number; pageSize?: number },
) {
  const pageSize = filter.pageSize ?? 50;
  const page = Math.max(1, filter.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (filter.targetId !== undefined) where.targetId = filter.targetId;
  if (filter.action) where.action = filter.action;
  if (isCentral(actor)) {
    if (filter.systemKey) where.systemKey = filter.systemKey;
  } else {
    const allowed = filter.systemKey ? actor.systems.filter((s) => s === filter.systemKey) : actor.systems;
    where.systemKey = { in: allowed };
  }

  const [entries, total, systems] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count({ where }),
    listSystems({ includeInactive: true }),
  ]);
  const ids = [...new Set(entries.flatMap((e) => [e.actorId, ...(e.targetId ? [e.targetId] : [])]))];
  const names = new Map((await getStaffByIds(ids)).map((p) => [p.id, p.name ?? ""]));
  return { entries, total, page, pages: Math.max(1, Math.ceil(total / pageSize)), names, systems: new Map(systems.map((s) => [s.key, s])) };
}

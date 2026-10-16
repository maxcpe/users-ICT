import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "./db";

export type AuditAction =
  | "user.create"
  | "user.update"
  | "user.deactivate"
  | "user.reactivate"
  | "user.delete"
  | "sensitive.view"
  | "sensitive.update"
  | "sensitive.check"
  | "system.clear"
  | "system.rename"
  | "system.create"
  | "system.update"
  | "system.levels"
  | "system.confirm"
  | "role.set"
  | "admin.assign"
  | "admin.revoke";

/** IP จาก nginx (X-Forwarded-For ตัวแรก) */
async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return (fwd || h.get("x-real-ip") || null)?.slice(0, 45) ?? null;
  } catch {
    return null; // นอก request (เช่น seed)
  }
}

/**
 * บันทึก audit log ต้องเรียกใน transaction เดียวกับการเปลี่ยนแปลงเสมอ (spec 7)
 * ข้อมูลอ่อนไหวให้ส่ง "changed" แทนค่า
 */
export async function writeAudit(
  tx: Tx,
  entry: {
    actorId: number;
    action: AuditAction;
    targetId?: number | null;
    systemKey?: string | null;
    changes: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetId: entry.targetId ?? null,
      systemKey: entry.systemKey ?? null,
      changes: entry.changes,
      ip: await clientIp(),
    },
  });
}

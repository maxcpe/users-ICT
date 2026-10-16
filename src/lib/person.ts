import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireActor } from "./access";
import { prisma } from "./db";
import { getStaffByIds } from "./registry";

/**
 * โหลดบุคลากรสำหรับหน้ารายคน
 * นักศึกษาหรือ id ที่ไม่มี ได้ 404 เหมือนกัน (spec 3.3) — getStaffByIds กรองนักศึกษาแล้ว
 */
export const loadPerson = cache(async (rawId: string) => {
  const actor = await requireActor();
  const id = /^\d{1,9}$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(id)) notFound();
  const [person] = await getStaffByIds([id]);
  if (!person) notFound();
  const status = await prisma.userStatus.findUnique({ where: { userId: id } });
  return { actor, person, status };
});

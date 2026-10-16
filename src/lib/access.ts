import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "./db";
import { getStaffByIds, getUsersLevel } from "./registry";
import { isCentral, roleFromLevel, type Actor } from "./roles";
import { normalizeEmail } from "./text";

/**
 * ผู้ใช้ปัจจุบัน อ่านบทบาทจากฐานทุก request ไม่เชื่อค่าใน session (spec 3.2)
 * คืน null ถ้าไม่ได้ล็อกอิน, "denied" ถ้าล็อกอินแล้วแต่ไม่มีสิทธิ์
 */
export const loadActor = cache(async (): Promise<Actor | "denied" | null> => {
  const session = await auth();
  const uid = session?.user?.uid;
  if (!uid) return null;

  const [staff] = await getStaffByIds([uid]);
  if (!staff) return "denied";

  const status = await prisma.userStatus.findUnique({ where: { userId: uid } });
  if (status?.status === "inactive") return "denied";

  const role = roleFromLevel(await getUsersLevel(uid));
  if (!role) return "denied";

  const systems =
    role === "system"
      ? (await prisma.systemAdmin.findMany({ where: { userId: uid }, select: { systemKey: true } })).map((s) => s.systemKey)
      : [];

  return {
    userId: uid,
    name: staff.name ?? "",
    email: normalizeEmail(staff.email ?? ""),
    role,
    systems,
  };
});

export async function requireActor(): Promise<Actor> {
  const a = await loadActor();
  if (a === null) redirect("/login");
  if (a === "denied") redirect("/login?error=denied");
  return a;
}

/** หน้าและ action ของผู้ดูแลกลาง คนอื่นได้ 404 (ไม่บอกว่ามีหน้านี้) */
export async function requireCentral(): Promise<Actor> {
  const a = await requireActor();
  if (!isCentral(a)) notFound();
  return a;
}

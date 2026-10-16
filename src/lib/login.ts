import "server-only";
import { prisma } from "./db";
import { authorize, identify, type LoginDecision } from "./login-rules";
import { findStaffByEmail, getUsersLevel } from "./registry";
import { normalizeEmail } from "./text";

/** ตัดสินการเข้าสู่ระบบด้วยบัญชี 365 และผูก oid กับ U_id ครั้งแรก */
export async function resolveLogin(rawEmail: string, oid: string): Promise<LoginDecision> {
  const email = normalizeEmail(rawEmail);
  const identity = await prisma.userIdentity.findUnique({ where: { oid } });
  const matches = identity ? [] : (await findStaffByEmail(email)).map((s) => s.id);
  const bound =
    matches.length === 1 ? await prisma.userIdentity.findUnique({ where: { userId: matches[0]! } }) : null;

  const who = identify({
    email,
    oid,
    identityUserId: identity?.userId ?? null,
    emailMatches: matches,
    boundOidForMatch: bound?.oid ?? null,
  });
  if (!who.ok) return who;

  const status = await prisma.userStatus.findUnique({ where: { userId: who.userId } });
  const deny = authorize(await getUsersLevel(who.userId), status?.status === "inactive");
  if (deny) return { ok: false, reason: deny };

  if (who.bind) {
    await prisma.userIdentity.create({ data: { userId: who.userId, oid } });
  } else {
    await prisma.userIdentity.update({ where: { oid }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
  }
  return who;
}

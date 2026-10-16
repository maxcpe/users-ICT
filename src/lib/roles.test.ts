import { describe, expect, it } from "vitest";
import { canSetRole, canViewSystem, roleFromLevel, type Actor } from "./roles";

const central: Actor = { userId: 1, name: "ก", email: "a@up.ac.th", role: "central", systems: [] };
const checkinAdmin: Actor = { userId: 3, name: "ข", email: "b@up.ac.th", role: "system", systems: ["checkin"] };

describe("บทบาทจาก user_roles (spec 3.2)", () => {
  it("99 ผู้ดูแลกลาง, 50 ผู้ดูแลระบบ, อื่นๆ เข้าไม่ได้", () => {
    expect(roleFromLevel(99)).toBe("central");
    expect(roleFromLevel(50)).toBe("system");
    expect(roleFromLevel(1)).toBeNull();
    expect(roleFromLevel(null)).toBeNull();
    expect(roleFromLevel(undefined)).toBeNull();
  });
});

describe("ขอบเขตของผู้ดูแลระบบ (spec 3.1)", () => {
  it("เห็นและตั้งสิทธิ์ได้เฉพาะระบบที่ดูแล", () => {
    expect(canViewSystem(checkinAdmin, "checkin")).toBe(true);
    expect(canViewSystem(checkinAdmin, "evaluation")).toBe(false);
    expect(canSetRole(checkinAdmin, "checkin", 10)).toBe(true);
    expect(canSetRole(checkinAdmin, "evaluation", 10)).toBe(false);
  });

  it("แก้สิทธิ์ของตัวเองไม่ได้", () => {
    expect(canSetRole(checkinAdmin, "checkin", checkinAdmin.userId)).toBe(false);
  });

  it("แตะระบบ users ไม่ได้ แม้จะถูกใส่ไว้ใน systems", () => {
    const sneaky: Actor = { ...checkinAdmin, systems: ["checkin", "users"] };
    expect(canViewSystem(sneaky, "users")).toBe(false);
    expect(canSetRole(sneaky, "users", 10)).toBe(false);
  });

  it("ผู้ดูแลกลางตั้งได้ทุกระบบ ยกเว้น users ซึ่งตั้งผ่านการแต่งตั้งผู้ดูแล", () => {
    expect(canSetRole(central, "evaluation", 10)).toBe(true);
    expect(canSetRole(central, "users", 10)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { checkCentralRevoke, checkRoleChange } from "./role-rules";
import type { Actor } from "./roles";

const central: Actor = { userId: 1, name: "ก", email: "a@up.ac.th", role: "central", systems: [] };
const checkinAdmin: Actor = { userId: 3, name: "ข", email: "b@up.ac.th", role: "system", systems: ["checkin"] };
const checkin = { key: "checkin", active: true, levels: [{ value: 1, label: "ผู้ใช้" }, { value: 90, label: "ผู้ใช้และผู้ดูแล" }, { value: 99, label: "ผู้ดูแลเท่านั้น" }] };

const base = { system: checkin, targetExists: true, targetInactive: false, current: 1 as number | null };

describe("checkRoleChange", () => {
  it("ตั้งเป็นระดับที่ลงทะเบียนหรือไม่มีสิทธิ์ได้", () => {
    expect(checkRoleChange({ ...base, actor: checkinAdmin, change: { userId: 10, systemKey: "checkin", value: 90 } })).toEqual({ ok: true, kind: "change" });
    expect(checkRoleChange({ ...base, actor: checkinAdmin, change: { userId: 10, systemKey: "checkin", value: null } })).toEqual({ ok: true, kind: "change" });
  });

  it("ห้ามตั้งค่าที่ไม่ได้ลงทะเบียน (กันพิมพ์ตัวเลขเอง)", () => {
    expect(checkRoleChange({ ...base, actor: central, change: { userId: 10, systemKey: "checkin", value: 7 } })).toEqual({ ok: false, reason: "bad_level" });
  });

  it("คงค่าอื่นเดิมไว้ได้ (ไม่นับเป็นการเปลี่ยน)", () => {
    expect(checkRoleChange({ ...base, current: 7, actor: central, change: { userId: 10, systemKey: "checkin", value: 7 } })).toEqual({ ok: true, kind: "same" });
  });

  it("ผู้ดูแลระบบตั้งระบบอื่นหรือตั้งตัวเองไม่ได้", () => {
    expect(checkRoleChange({ ...base, system: { ...checkin, key: "evaluation" }, actor: checkinAdmin, change: { userId: 10, systemKey: "evaluation", value: 1 } })).toMatchObject({ ok: false, reason: "forbidden" });
    expect(checkRoleChange({ ...base, actor: checkinAdmin, change: { userId: 3, systemKey: "checkin", value: 99 } })).toMatchObject({ ok: false, reason: "forbidden" });
  });

  it("ตั้งสิทธิ์ให้คนที่ปิดใช้งาน หรือนักศึกษา/ไม่มีแถว ไม่ได้", () => {
    expect(checkRoleChange({ ...base, targetInactive: true, actor: central, change: { userId: 10, systemKey: "checkin", value: 1 } })).toMatchObject({ ok: false, reason: "deactivated" });
    expect(checkRoleChange({ ...base, targetExists: false, actor: central, change: { userId: 10, systemKey: "checkin", value: 1 } })).toMatchObject({ ok: false, reason: "not_staff" });
  });

  it("ระบบที่ซ่อนอยู่หรือไม่มีอยู่ตั้งไม่ได้", () => {
    expect(checkRoleChange({ ...base, system: { ...checkin, active: false }, actor: central, change: { userId: 10, systemKey: "checkin", value: 1 } })).toMatchObject({ ok: false, reason: "inactive_system" });
    expect(checkRoleChange({ ...base, system: null, actor: central, change: { userId: 10, systemKey: "x", value: 1 } })).toMatchObject({ ok: false, reason: "no_system" });
  });

  it("ระบบ users ตั้งผ่านหน้านี้ไม่ได้ แม้เป็นผู้ดูแลกลาง", () => {
    expect(checkRoleChange({ ...base, system: { ...checkin, key: "users" }, actor: central, change: { userId: 10, systemKey: "users", value: 99 } })).toMatchObject({ ok: false, reason: "forbidden" });
  });
});

describe("checkCentralRevoke (spec 3.2)", () => {
  it("ถอนผู้ดูแลกลางคนอื่นได้ เมื่อยังเหลือคนที่ใช้งานอยู่", () => {
    expect(checkCentralRevoke({ actorId: 1, targetId: 2, activeOthers: 1 })).toEqual({ ok: true });
  });
  it("ถอนตัวเองไม่ได้", () => {
    expect(checkCentralRevoke({ actorId: 1, targetId: 1, activeOthers: 3 })).toMatchObject({ ok: false });
  });
  it("ถอนคนสุดท้ายที่ใช้งานอยู่ไม่ได้", () => {
    expect(checkCentralRevoke({ actorId: 1, targetId: 2, activeOthers: 0 })).toMatchObject({ ok: false });
  });
});

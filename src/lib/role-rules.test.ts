import { describe, expect, it } from "vitest";
import { checkRoleChange } from "./role-rules";
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

describe("checkRoleChange — หลายสิทธิ์ต่อคน (spec 2.3)", () => {
  const evaluation = {
    key: "evaluation",
    active: true,
    multi: true,
    levels: [{ value: 1, label: "ผู้ใช้งาน" }, { value: 50, label: "สร้างการประเมิน" }, { value: 80, label: "ฝ่ายบุคคล" }],
  };
  const m = { system: evaluation, targetExists: true, targetInactive: false, current: null, actor: central };
  const ch = (levels?: number[]) => ({ userId: 10, systemKey: "evaluation", value: null, levels });

  it("ถือหลายบทบาทที่ลงทะเบียนได้", () => {
    expect(checkRoleChange({ ...m, currentSet: [1], change: ch([1, 50, 80]) })).toEqual({ ok: true, kind: "change" });
  });

  it("ชุดเดิม (ลำดับต่างหรือซ้ำ) นับเป็นไม่เปลี่ยน", () => {
    expect(checkRoleChange({ ...m, currentSet: [50, 1], change: ch([1, 50, 50]) })).toEqual({ ok: true, kind: "same" });
  });

  it("ถอนทุกบทบาท = ไม่มีสิทธิ์", () => {
    expect(checkRoleChange({ ...m, currentSet: [1, 50], change: ch([]) })).toEqual({ ok: true, kind: "change" });
  });

  it("เพิ่มบทบาทที่ไม่ได้ลงทะเบียนไม่ได้ แต่คงค่าอื่นเดิมไว้ได้", () => {
    expect(checkRoleChange({ ...m, currentSet: [1], change: ch([1, 7]) })).toEqual({ ok: false, reason: "bad_level" });
    expect(checkRoleChange({ ...m, currentSet: [7], change: ch([7, 50]) })).toEqual({ ok: true, kind: "change" });
  });

  it("ระบบหลายสิทธิ์ต้องส่งชุดบทบาท และระบบปกติห้ามส่งชุดบทบาท", () => {
    expect(checkRoleChange({ ...m, currentSet: [], change: { userId: 10, systemKey: "evaluation", value: 50 } })).toEqual({ ok: false, reason: "bad_level" });
    expect(checkRoleChange({ ...base, actor: central, change: { userId: 10, systemKey: "checkin", value: null, levels: [1, 90] } })).toEqual({ ok: false, reason: "bad_level" });
  });

  it("กฎเดิมยังใช้: ห้ามตั้งตัวเองและคนที่ปิดใช้งาน", () => {
    const admin: Actor = { ...checkinAdmin, systems: ["evaluation"] };
    expect(checkRoleChange({ ...m, actor: admin, currentSet: [], change: { ...ch([1]), userId: 3 } })).toMatchObject({ ok: false, reason: "forbidden" });
    expect(checkRoleChange({ ...m, targetInactive: true, currentSet: [], change: ch([1]) })).toMatchObject({ ok: false, reason: "deactivated" });
  });
});

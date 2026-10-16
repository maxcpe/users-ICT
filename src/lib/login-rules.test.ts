import { describe, expect, it } from "vitest";
import { authorize, identify, type LoginFacts } from "./login-rules";

const base: LoginFacts = {
  email: "test.support02@up.ac.th",
  identityUserId: null,
  emailMatches: [3],
  boundOidForMatch: null,
  oid: "oid-a",
};

describe("identify (spec 5.5)", () => {
  it("ครั้งแรก: จับคู่ด้วยอีเมลแล้วผูก oid", () => {
    expect(identify(base)).toEqual({ ok: true, userId: 3, bind: true });
  });
  it("เคยผูก oid แล้ว ใช้ U_id เดิมแม้อีเมลเปลี่ยน", () => {
    expect(identify({ ...base, email: "new.name@up.ac.th", emailMatches: [], identityUserId: 3 })).toEqual({
      ok: true,
      userId: 3,
      bind: false,
    });
  });
  it("อีเมลนอกมหาวิทยาลัยเข้าไม่ได้", () => {
    expect(identify({ ...base, email: "someone@gmail.com" })).toEqual({ ok: false, reason: "domain" });
  });
  it("อีเมลซ้ำหลายแถว ไม่เดาเอา", () => {
    expect(identify({ ...base, emailMatches: [12, 17] })).toEqual({ ok: false, reason: "duplicate_email" });
  });
  it("แถวที่ผูกกับบัญชี 365 อื่นอยู่แล้วเข้าไม่ได้", () => {
    expect(identify({ ...base, boundOidForMatch: "oid-b" })).toEqual({ ok: false, reason: "identity_mismatch" });
  });
  it("ไม่พบในทะเบียน", () => {
    expect(identify({ ...base, emailMatches: [] })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("authorize", () => {
  it("ต้องมีระดับ 50 หรือ 99 ในระบบ users และไม่ถูกปิดใช้งาน", () => {
    expect(authorize(99, false)).toBeNull();
    expect(authorize(50, false)).toBeNull();
    expect(authorize(1, false)).toBe("denied");
    expect(authorize(null, false)).toBe("denied");
    expect(authorize(99, true)).toBe("inactive");
  });
});

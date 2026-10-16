import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeHmac, dashed, isValidThaiId, matchingModes } from "./idcard";

// เลขบัตรสมมติที่ check digit ถูก (ไม่ใช่ของคนจริง)
const FAKE_ID = "1101700230708";
const KEY = "a".repeat(64);

describe("เลขบัตรประชาชน (spec 6.1)", () => {
  it("ตรวจ check digit", () => {
    expect(isValidThaiId(FAKE_ID)).toBe(true);
    expect(isValidThaiId("1-1017-00230-70-8")).toBe(true);
    expect(isValidThaiId("1101700230707")).toBe(false);
    expect(isValidThaiId("123")).toBe(false);
  });

  it("จัดรูปแบบมีขีด", () => {
    expect(dashed(FAKE_ID)).toBe("1-1017-00230-70-8");
  });

  it("HMAC-SHA256 เป็น hex ตัวพิมพ์เล็ก 64 ตัว", () => {
    const h = computeHmac(FAKE_ID, KEY, "text-digits");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(createHmac("sha256", KEY).update(FAKE_ID).digest("hex"));
  });

  it("บอกได้ว่าแบบไหนตรงกับค่าที่เก็บ", () => {
    const stored = computeHmac(FAKE_ID, KEY, "hex-dashed");
    expect(matchingModes(FAKE_ID, KEY, stored)).toEqual(["hex-dashed"]);
    expect(matchingModes(FAKE_ID, KEY, stored.toUpperCase())).toEqual(["hex-dashed"]);
    expect(matchingModes("1101700230713", KEY, stored)).toEqual([]);
  });

  it("คีย์ที่ไม่ใช่ hex ไม่ลองแบบ hex", () => {
    const stored = computeHmac(FAKE_ID, "not-hex-key", "text-digits");
    expect(matchingModes(FAKE_ID, "not-hex-key", stored)).toEqual(["text-digits"]);
  });
});

import { describe, expect, it } from "vitest";
import { bangkokToday, checkDeactivate, deleteBlockers, isScheduled, maskPhone, maskRfid } from "./lifecycle-rules";

const base = { actorId: 1, targetId: 3, alreadyInactive: false, targetIsCentral: false, otherActiveCentrals: 0, effectiveDate: "2026-10-09", today: "2026-10-09" };

describe("ปิดใช้งาน (spec 3.2, 4.5)", () => {
  it("ปิดวันนี้ได้", () => expect(checkDeactivate(base)).toBeNull());
  it("ปิดตัวเองไม่ได้", () => expect(checkDeactivate({ ...base, targetId: 1 })).toMatch(/ตัวเอง/));
  it("ปิดผู้ดูแลกลางคนสุดท้ายไม่ได้", () => {
    expect(checkDeactivate({ ...base, targetIsCentral: true, otherActiveCentrals: 0 })).toMatch(/คนสุดท้าย/);
    expect(checkDeactivate({ ...base, targetIsCentral: true, otherActiveCentrals: 1 })).toBeNull();
  });
  it("ปิดซ้ำไม่ได้", () => expect(checkDeactivate({ ...base, alreadyInactive: true })).toMatch(/อยู่แล้ว/));
  it("วันที่ย้อนหลังไม่ได้ ล่วงหน้าได้", () => {
    expect(checkDeactivate({ ...base, effectiveDate: "2026-10-08" })).toMatch(/วันนี้/);
    expect(checkDeactivate({ ...base, effectiveDate: "2026-10-31" })).toBeNull();
    expect(isScheduled("2026-10-31", "2026-10-09")).toBe(true);
    expect(isScheduled("2026-10-09", "2026-10-09")).toBe(false);
  });
  it("วันที่ตามเวลาไทย", () => {
    expect(bangkokToday(new Date("2026-10-08T18:30:00Z"))).toBe("2026-10-09");
  });
});

describe("ลบแถวที่เพิ่มผิด (spec 4.5.1)", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const clean = { createdAt: new Date("2026-10-07T12:00:00Z"), now, nonNullRoleColumns: [], tableRoleCount: 0, adminCount: 0, hasIdentity: false };

  it("ผ่านทุกเงื่อนไข ลบได้", () => expect(deleteBlockers(clean)).toEqual([]));
  it("แถวที่มีอยู่ก่อนระบบนี้ลบไม่ได้", () => expect(deleteBlockers({ ...clean, createdAt: null })).toHaveLength(1));
  it("เกิน 7 วันลบไม่ได้", () => expect(deleteBlockers({ ...clean, createdAt: new Date("2026-10-01T12:00:00Z") })).toHaveLength(1));
  it("ยังมีสิทธิ์ (รวมคอลัมน์นอกทะเบียน) ลบไม่ได้", () => {
    expect(deleteBlockers({ ...clean, nonNullRoleColumns: ["U_van"] })).toHaveLength(1);
    expect(deleteBlockers({ ...clean, tableRoleCount: 1 })).toHaveLength(1);
  });
  it("เป็นผู้ดูแลหรือเคยล็อกอินลบไม่ได้", () => {
    expect(deleteBlockers({ ...clean, adminCount: 1 })).toHaveLength(1);
    expect(deleteBlockers({ ...clean, hasIdentity: true })).toHaveLength(1);
  });
});

describe("ปิดบังข้อมูลอ่อนไหว (spec 6.2)", () => {
  it("RFID แสดง 4 ตัวท้าย", () => {
    expect(maskRfid("0002915814")).toBe("•••• 5814");
    expect(maskRfid(null)).toBeNull();
  });
  it("เบอร์โทรแสดงตัวแรกกับ 3 ตัวท้าย", () => {
    expect(maskPhone("081-234-5567")).toBe("0••-•••-•567");
    expect(maskPhone("2326")).toBe("••••");
    expect(maskPhone(null)).toBeNull();
  });
});

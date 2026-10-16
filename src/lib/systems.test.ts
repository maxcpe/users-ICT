import { describe, expect, it } from "vitest";
import {
  checkLevelChange,
  describeLevel,
  levelSetText,
  isAllowedRoleColumn,
  isValidSystemKey,
  parseLevels,
  type Level,
} from "./systems";

const evaluation: Level[] = [
  { value: 1, label: "ผู้ใช้" },
  { value: 50, label: "จนท.สร้างการประเมิน" },
  { value: 80, label: "ฝ่ายบุคคล" },
  { value: 99, label: "ผู้ดูแลระบบ" },
];

describe("allowlist คอลัมน์ (spec 7)", () => {
  const existing = new Set(["U_evaluation", "U_checkin", "U_name"]);

  it("รับเฉพาะคอลัมน์ U_ ตัวพิมพ์เล็กที่มีอยู่จริง", () => {
    expect(isAllowedRoleColumn("U_evaluation", existing)).toBe(true);
    expect(isAllowedRoleColumn("U_van", existing)).toBe(false);
  });

  it("ไม่รับชื่อที่มีอักขระอื่น แม้จะอยู่ในรายการ", () => {
    const tricky = new Set(["U_x`; DROP TABLE user; --", "U_Evaluation", "U_eval1"]);
    for (const name of tricky) expect(isAllowedRoleColumn(name, tricky)).toBe(false);
  });
});

describe("key ของระบบ", () => {
  it("ตัวพิมพ์เล็ก ตัวเลข _ ขึ้นต้นด้วยตัวอักษร", () => {
    expect(isValidSystemKey("library")).toBe(true);
    expect(isValidSystemKey("lib_2")).toBe(true);
    expect(isValidSystemKey("Library")).toBe(false);
    expect(isValidSystemKey("2lib")).toBe(false);
    expect(isValidSystemKey("l")).toBe(false);
    expect(isValidSystemKey("lib-x")).toBe(false);
  });

  it("ใช้ key `users` ของระบบนี้ไม่ได้", () => {
    expect(isValidSystemKey("users")).toBe(false);
  });
});

describe("แสดงระดับ", () => {
  it("ค่าที่ไม่ได้ลงทะเบียนเป็น 'ค่าอื่น' ไม่ถูกทิ้ง", () => {
    expect(describeLevel(evaluation, 7)).toEqual({ kind: "other", value: 7 });
  });
  it("NULL = ไม่มีสิทธิ์", () => {
    expect(describeLevel(evaluation, null)).toEqual({ kind: "none" });
  });
  it("ระดับสูงสุดถูกทำเครื่องหมาย", () => {
    expect(describeLevel(evaluation, 99)).toMatchObject({ kind: "known", top: true });
    expect(describeLevel(evaluation, 1)).toMatchObject({ kind: "known", top: false, label: "ผู้ใช้" });
  });
});

describe("parseLevels", () => {
  it("เรียงจากต่ำไปสูง", () => {
    expect(parseLevels([{ value: 99, label: "ก" }, { value: 1, label: "ข" }]).map((l) => l.value)).toEqual([1, 99]);
  });
  it("JSON เสียได้ผลว่าง", () => {
    expect(parseLevels({ nope: true })).toEqual([]);
    expect(parseLevels([{ value: "1", label: "x" }])).toEqual([]);
  });
});

describe("แก้ระดับที่มีคนใช้อยู่ (spec 5.1)", () => {
  const inUse = new Map([[1, 72], [90, 5], [99, 0]]);
  const base: Level[] = [{ value: 1, label: "ผู้ใช้" }, { value: 90, label: "ผู้ใช้และผู้ดูแล" }, { value: 99, label: "ผู้ดูแลเท่านั้น" }];

  it("เปลี่ยนชื่อได้", () => {
    expect(checkLevelChange(base.map((l) => ({ ...l, label: l.label + " (ใหม่)" })), inUse)).toEqual([]);
  });
  it("ลบระดับที่ไม่มีคนใช้ได้", () => {
    expect(checkLevelChange(base.filter((l) => l.value !== 99), inUse)).toEqual([]);
  });
  it("ลบหรือเปลี่ยนค่าระดับที่มีคนใช้ไม่ได้", () => {
    expect(checkLevelChange(base.filter((l) => l.value !== 90), inUse)).toEqual([{ code: "in_use", value: 90, count: 5 }]);
    const renumbered = base.map((l) => (l.value === 90 ? { ...l, value: 91 } : l));
    expect(checkLevelChange(renumbered, inUse)).toContainEqual({ code: "in_use", value: 90, count: 5 });
  });
  it("ค่าซ้ำและรายการว่างไม่ผ่าน", () => {
    expect(checkLevelChange([{ value: 1, label: "a" }, { value: 1, label: "b" }], new Map())).toEqual([{ code: "duplicate", value: 1 }]);
    expect(checkLevelChange([], new Map())).toEqual([{ code: "empty" }]);
  });
});

describe("levelSetText", () => {
  const lv = [{ value: 1, label: "ผู้ใช้งาน" }, { value: 80, label: "ฝ่ายบุคคล" }];
  it("เรียงจากน้อยไปมาก และบอกค่าอื่น", () => {
    expect(levelSetText(lv, [80, 1])).toBe("ผู้ใช้งาน, ฝ่ายบุคคล");
    expect(levelSetText(lv, [7])).toBe("ค่าอื่น (7)");
  });
  it("ว่าง = ไม่มีสิทธิ์", () => {
    expect(levelSetText(lv, [])).toBe("ไม่มีสิทธิ์");
  });
});

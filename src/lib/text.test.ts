import { describe, expect, it } from "vitest";
import { blankToNull, escapeLike, hasFourByteChars, initials, isStudentPosition, normalizeEmail } from "./text";

describe("text", () => {
  it("อีเมลตัดช่องว่างและเป็นตัวพิมพ์เล็ก", () => {
    expect(normalizeEmail("  Test.Academic03@UP.ac.th ")).toBe("test.academic03@up.ac.th");
  });
  it("จับอีโมจิ (4 ไบต์) แต่ไม่จับภาษาไทย", () => {
    expect(hasFourByteChars("นายทดสอบ สอง")).toBe(false);
    expect(hasFourByteChars("ทดสอบ 😀")).toBe(true);
  });
  it("NULL, '', '-' ถือเป็นไม่มีข้อมูล", () => {
    expect(blankToNull(null)).toBeNull();
    expect(blankToNull("")).toBeNull();
    expect(blankToNull(" - ")).toBeNull();
    expect(blankToNull("2326")).toBe("2326");
  });
  it("escape อักขระพิเศษของ LIKE", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
  it("ตำแหน่งนักศึกษา", () => {
    expect(isStudentPosition("นักศึกษา")).toBe(true);
    expect(isStudentPosition("นักศึกษาปริญญาโท")).toBe(true);
    expect(isStudentPosition("อาจารย์")).toBe(false);
    expect(isStudentPosition(null)).toBe(false);
  });
  it("อักษรย่อข้ามคำนำหน้าและสระหน้า", () => {
    expect(initials("ผู้ช่วยศาสตราจารย์ ดร.ทดสอบ เก้า")).toBe("ทก");
    expect(initials("นางสาวทดสอบ เกวรินทร์")).toBe("ทก");
    expect(initials("ดร.เกวรินทร์ จันทร์ดำ")).toBe("กจ");
  });
});

import { describe, expect, it } from "vitest";
import { diffStaff, staffSchema } from "./staff-rules";

const ok = {
  name: " นางสาวทดสอบ ใหม่ ",
  email: " Test.New@UP.ac.th ",
  position: "นักวิชาการศึกษา",
  branch: "สำนักงานคณะ",
  job: "งานวิชาการ",
};

describe("staffSchema (spec 4.2)", () => {
  it("ตัดช่องว่างและแปลงอีเมลเป็นตัวพิมพ์เล็ก", () => {
    const r = staffSchema.parse(ok);
    expect(r.email).toBe("test.new@up.ac.th");
    expect(r.name).toBe("นางสาวทดสอบ ใหม่");
  });

  it("อีเมลต้องเป็น @up.ac.th", () => {
    expect(staffSchema.safeParse({ ...ok, email: "someone@gmail.com" }).success).toBe(false);
    expect(staffSchema.safeParse({ ...ok, email: "x@up.ac.th.evil.com" }).success).toBe(false);
  });

  it("ห้ามตั้งตำแหน่งนักศึกษา", () => {
    expect(staffSchema.safeParse({ ...ok, position: "นักศึกษาปริญญาตรี" }).success).toBe(false);
  });

  it("ห้ามอีโมจิ (ตาราง utf8mb3)", () => {
    expect(staffSchema.safeParse({ ...ok, name: "ทดสอบ 😀" }).success).toBe(false);
    expect(staffSchema.safeParse({ ...ok, job: "งาน 🎉" }).success).toBe(false);
  });

  it("สายสนับสนุนต้องมีงาน สายวิชาการไม่ต้อง", () => {
    expect(staffSchema.safeParse({ ...ok, job: "" }).success).toBe(false);
    const academic = staffSchema.parse({ ...ok, branch: "วิทยาการคอมพิวเตอร์", position: "อาจารย์", job: "-" });
    expect(academic.job).toBeNull();
  });

  it("ช่องบังคับว่างไม่ได้", () => {
    expect(staffSchema.safeParse({ ...ok, name: "  " }).success).toBe(false);
    expect(staffSchema.safeParse({ ...ok, branch: "" }).success).toBe(false);
  });
});

describe("diffStaff (spec 4.3)", () => {
  const before = { name: "นางสาวทดสอบ ใหม่", email: "test.new@up.ac.th ", position: "นักวิชาการศึกษา", branch: "สำนักงานคณะ", job: "งานวิชาการ" };

  it("ช่องว่างท้ายอีเมลเดิมไม่นับเป็นการเปลี่ยน", () => {
    expect(diffStaff(before, staffSchema.parse(ok))).toEqual({});
  });

  it("คืนเฉพาะช่องที่เปลี่ยน พร้อมค่าเดิมและค่าใหม่", () => {
    const after = staffSchema.parse({ ...ok, position: "หัวหน้างานวิชาการ" });
    expect(diffStaff(before, after)).toEqual({ position: ["นักวิชาการศึกษา", "หัวหน้างานวิชาการ"] });
  });

  it("'-' และ '' ในงานเดิมถือเป็นไม่มีข้อมูล", () => {
    const after = staffSchema.parse({ ...ok, branch: "วิทยาการคอมพิวเตอร์", job: "" });
    expect(diffStaff({ ...before, branch: "วิทยาการคอมพิวเตอร์", job: "-" }, after)).toEqual({});
  });
});

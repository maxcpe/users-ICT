import { describe, expect, it } from "vitest";
import { pageWindow } from "./pager";

describe("pageWindow", () => {
  it("หน้าน้อยแสดงครบ", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
  it("หน้าเยอะย่อด้วย …", () => {
    expect(pageWindow(50, 100)).toEqual([1, "…", 49, 50, 51, "…", 100]);
    expect(pageWindow(1, 100)).toEqual([1, 2, "…", 100]);
    expect(pageWindow(100, 100)).toEqual([1, "…", 99, 100]);
  });
});

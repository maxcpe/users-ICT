import { describe, expect, it } from "vitest";
import { withBasePath } from "./base-path";

describe("withBasePath", () => {
  it("เติม /users เมื่อ Next.js ตัดออก", () => {
    expect(withBasePath("/api/auth/callback/microsoft-entra-id", "/users")).toBe("/users/api/auth/callback/microsoft-entra-id");
  });
  it("ไม่เติมซ้ำ", () => {
    expect(withBasePath("/users/api/auth/csrf", "/users")).toBe("/users/api/auth/csrf");
    expect(withBasePath("/users", "/users")).toBe("/users");
  });
  it("ไม่สับสนกับ path ที่ขึ้นต้นคล้ายกัน", () => {
    expect(withBasePath("/usersx/api", "/users")).toBe("/users/usersx/api");
  });
  it("ตอนพัฒนาไม่มี basePath ไม่เปลี่ยนอะไร", () => {
    expect(withBasePath("/api/auth/csrf", "")).toBe("/api/auth/csrf");
  });
});

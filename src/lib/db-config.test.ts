import { describe, expect, it } from "vitest";
import { mariadbConfig } from "./db-config";

describe("mariadbConfig", () => {
  it("ต่อแบบ TLS เสมอ และ pool เล็ก (กันโดนบล็อก error 1129)", () => {
    const c = mariadbConfig("mysql://ictservice:p%40ss%3Aw@db.example.local:3306/user");
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
    expect(c.connectionLimit).toBeLessThanOrEqual(5);
  });

  it("อ่าน host port user password และฐานจาก URL (ถอดรหัส %xx)", () => {
    const c = mariadbConfig("mysql://ictservice:p%40ss%3Aw@db.example.local:3307/user");
    expect(c).toMatchObject({ host: "db.example.local", port: 3307, user: "ictservice", password: "p@ss:w", database: "user" });
  });
});

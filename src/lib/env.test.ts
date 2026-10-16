import { describe, expect, it } from "vitest";
import { dangerousGrants, EnvError, resolveDbNames } from "./env";

const devUrl = "mysql://a:b@10.0.0.1:3306/usermanagement_dev";

describe("resolveDbNames", () => {
  it("ไม่ต้องตั้ง USER_DB / APP_DB: เดาจาก DATABASE_URL และโหมด", () => {
    expect(resolveDbNames({ DATABASE_URL: devUrl, NODE_ENV: "development" })).toEqual({
      userDb: "user_dev",
      appDb: "usermanagement_dev",
      rolesDb: "user_dev",
      userDbReadOnly: false,
      liveWrites: false,
    });
    expect(resolveDbNames({ DATABASE_URL: "mysql://a:b@h/usermanagement", NODE_ENV: "production" })).toMatchObject({
      userDb: "user",
      appDb: "usermanagement",
      rolesDb: "user",
      userDbReadOnly: false,
      liveWrites: false,
    });
  });

  it("ตั้งเองใน .env ได้", () => {
    expect(resolveDbNames({ USER_DB: "user2_dev", DATABASE_URL: devUrl }).userDb).toBe("user2_dev");
  });

  it("โหมดพัฒนาที่ DATABASE_URL ชี้ไปฐานจริงโดยไม่ได้ตั้งอ่านอย่างเดียว หยุดทันที", () => {
    expect(() => resolveDbNames({ DATABASE_URL: "mysql://a:b@10.0.0.1:3306/user", NODE_ENV: "development" })).toThrow(EnvError);
    expect(() => resolveDbNames({ DATABASE_URL: "mysql://a:b@10.0.0.1:3306/usermanagement" })).toThrow(EnvError);
    expect(() => resolveDbNames({ DATABASE_URL: "mysql://a:b@h/user", USER_DB: "user" })).toThrow(EnvError);
  });

  it("โหมดพัฒนาที่ตั้ง USER_DB เป็นฐานจริงโดยไม่ได้ตั้งอ่านอย่างเดียว หยุดทันที", () => {
    expect(() => resolveDbNames({ USER_DB: "user", DATABASE_URL: devUrl, NODE_ENV: "test" })).toThrow(EnvError);
  });

  it("โหมดอ่านข้อมูลจริง: user_roles ใช้ของฐานพัฒนา และห้ามเขียน user", () => {
    expect(resolveDbNames({ USER_DB: "user", USER_DB_READONLY: "yes", DATABASE_URL: devUrl })).toEqual({
      userDb: "user",
      appDb: "usermanagement_dev",
      rolesDb: "usermanagement_dev",
      userDbReadOnly: true,
      liveWrites: false,
    });
  });

  it("โหมดอ่านข้อมูลจริงแบบเก็บทุกอย่างในฐาน user (เลือกใช้ 9 ต.ค. 2569)", () => {
    expect(resolveDbNames({ USER_DB: "user", USER_DB_READONLY: "yes", DATABASE_URL: "mysql://a:b@h/user" })).toEqual({
      userDb: "user",
      appDb: "user",
      rolesDb: "user",
      userDbReadOnly: true,
      liveWrites: false,
    });
    // ฐานอื่นที่ไม่ใช่ user และไม่ใช่ _dev ไม่ได้
    expect(() => resolveDbNames({ USER_DB: "user", USER_DB_READONLY: "yes", DATABASE_URL: "mysql://a:b@h/evaluation" })).toThrow(EnvError);
  });

  it("ALLOW_PRODUCTION_WRITES: เขียนฐาน user จริงได้ตอนพัฒนา (เลือกใช้ 9 ต.ค. 2569)", () => {
    expect(resolveDbNames({ USER_DB: "user", ALLOW_PRODUCTION_WRITES: "yes", DATABASE_URL: "mysql://a:b@h/user" })).toEqual({
      userDb: "user",
      appDb: "user",
      rolesDb: "user",
      userDbReadOnly: false,
      liveWrites: true,
    });
  });

  it("ตั้งทั้งอ่านอย่างเดียวและเขียนจริงพร้อมกันไม่ได้", () => {
    expect(() =>
      resolveDbNames({ USER_DB: "user", USER_DB_READONLY: "yes", ALLOW_PRODUCTION_WRITES: "yes", DATABASE_URL: "mysql://a:b@h/user" }),
    ).toThrow(EnvError);
  });

  it("ALLOW_PRODUCTION_WRITES ห้ามใช้ใน production", () => {
    expect(() =>
      resolveDbNames({ ALLOW_PRODUCTION_WRITES: "yes", DATABASE_URL: "mysql://a:b@h/usermanagement", NODE_ENV: "production" }),
    ).toThrow(EnvError);
  });

  it("ห้ามตั้งอ่านอย่างเดียวใน production", () => {
    expect(() =>
      resolveDbNames({ USER_DB_READONLY: "yes", DATABASE_URL: "mysql://a:b@h/usermanagement", NODE_ENV: "production" }),
    ).toThrow(EnvError);
  });

  it("ถ้าตั้ง APP_DB ต้องตรงกับฐานใน DATABASE_URL", () => {
    expect(() => resolveDbNames({ APP_DB: "usermanagement_dev", DATABASE_URL: "mysql://a:b@h/other_dev" })).toThrow(EnvError);
  });

  it("DATABASE_URL ไม่มีชื่อฐาน", () => {
    expect(() => resolveDbNames({ DATABASE_URL: "mysql://a:b@10.0.0.1:3306" })).toThrow(EnvError);
  });

  it("ไม่รับชื่อฐานที่มีอักขระแปลก (กัน SQL injection ผ่านชื่อฐาน)", () => {
    expect(() => resolveDbNames({ USER_DB: "user`; DROP", DATABASE_URL: "mysql://a:b@h/x", NODE_ENV: "production" })).toThrow(EnvError);
    expect(() => resolveDbNames({ USER_DB: "User_dev", DATABASE_URL: devUrl })).toThrow(EnvError);
  });

  it("ข้อความ error ไม่มีรหัสผ่าน", () => {
    try {
      resolveDbNames({ DATABASE_URL: "mysql://u:SECRET@h/user" });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain("SECRET");
    }
  });
});

describe("dangerousGrants (โหมดอ่านข้อมูลจริง)", () => {
  it("บัญชีที่มีแค่ SELECT บนฐาน user ผ่าน", () => {
    expect(
      dangerousGrants(
        [
          "GRANT USAGE ON *.* TO `usermanagement_dev`@`%`",
          "GRANT SELECT ON `user`.`user` TO `usermanagement_dev`@`%`",
          "GRANT ALL PRIVILEGES ON `usermanagement_dev`.* TO `usermanagement_dev`@`%`",
        ],
        "user",
      ),
    ).toEqual([]);
  });

  it("จับบัญชีแบบ ictservice ที่แก้/ลบฐาน user ได้", () => {
    const g = "GRANT SELECT, INSERT, UPDATE, DELETE ON `user`.* TO `ictservice`@`%`";
    expect(dangerousGrants([g], "user")).toEqual([g]);
  });

  it("จับสิทธิ์ทั้งเซิร์ฟเวอร์และสิทธิ์รายคอลัมน์", () => {
    expect(dangerousGrants(["GRANT ALL PRIVILEGES ON *.* TO `root`@`%`"], "user")).toHaveLength(1);
    expect(dangerousGrants(["GRANT SELECT, UPDATE (`U_van`) ON `user`.`user` TO `x`@`%`"], "user")).toHaveLength(1);
  });

  it("ไม่สับสนกับฐานชื่อคล้ายกัน", () => {
    expect(dangerousGrants(["GRANT ALL PRIVILEGES ON `user_dev`.* TO `x`@`%`", "GRANT ALL PRIVILEGES ON `usermanagement_dev`.* TO `x`@`%`"], "user")).toEqual([]);
  });
});

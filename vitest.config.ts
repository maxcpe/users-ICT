import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// spec 10: test ไม่แตะฐานข้อมูลจริง — ทดสอบเฉพาะ logic ที่ไม่ต้องต่อฐาน
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});

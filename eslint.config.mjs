import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "src/generated/**", "docs/**", "next-env.d.ts", ".agents/**", ".claude/**"] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // spec 6.3: ห้าม log ข้อมูล request — ใช้ console.warn/error เฉพาะข้อความที่ไม่มีข้อมูลผู้ใช้
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
];

export default config;

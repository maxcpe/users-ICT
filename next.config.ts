import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "standalone",
  // spec 11.1: basePath เฉพาะ production (nginx ส่ง /users ต่อมาที่พอร์ต 3006)
  basePath: isProd ? "/users" : undefined,
  poweredByHeader: false,
  // ไม่ใช้การย่อรูปของ Next.js (มีแค่ตราคณะ) ปิด /_next/image ทั้งหมด ลดพื้นที่โจมตี (GHSA-2464-fhr4-w9xw)
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

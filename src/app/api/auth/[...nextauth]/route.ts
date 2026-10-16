import { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { withBasePath } from "@/lib/base-path";

// Next.js 16 ส่ง path ให้ route handler แบบตัด basePath (/users) ออก เช่น /api/auth/callback/…
// แต่ Auth.js ใช้ basePath จาก AUTH_URL (/users/api/auth) จึงตอบ "Bad request." ทุกคำขอ
// เติม basePath กลับก่อนส่งต่อ (production เท่านั้น ตอนพัฒนาไม่มี basePath)
function wrap(handler: (req: NextRequest) => Promise<Response>) {
  return (req: NextRequest) => {
    const url = new URL(req.url);
    const fixed = withBasePath(url.pathname);
    if (fixed === url.pathname) return handler(req);
    url.pathname = fixed;
    return handler(new NextRequest(url, req));
  };
}

export const GET = wrap(handlers.GET);
export const POST = wrap(handlers.POST);

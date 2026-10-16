// basePath ของแอป ต้องตรงกับ next.config.ts (spec 11.1: /users เฉพาะ production)
export const BASE_PATH = process.env.NODE_ENV === "production" ? "/users" : "";

/** เติม basePath หน้า pathname ถ้ายังไม่มี */
export function withBasePath(pathname: string, base = BASE_PATH): string {
  if (!base || pathname === base || pathname.startsWith(`${base}/`)) return pathname;
  return `${base}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}

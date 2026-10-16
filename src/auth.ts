import NextAuth, { type DefaultSession } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { withBasePath } from "@/lib/base-path";
import { resolveLogin } from "@/lib/login";

declare module "next-auth" {
  interface Session {
    user: { uid?: number } & DefaultSession["user"];
  }
}

// next-auth/jwt re-export จาก @auth/core/jwt จึงต้อง augment ที่ต้นทาง
declare module "@auth/core/jwt" {
  interface JWT {
    uid?: number;
  }
}

const isProd = process.env.NODE_ENV === "production";
// spec 7: cookie path=/users, Secure, HttpOnly, SameSite=Lax
const cookiePath = isProd ? "/users" : "/";
const prefix = isProd ? "__Secure-" : "";
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: cookiePath, secure: isProd };

type EntraProfile = { oid?: string; email?: string | null; preferred_username?: string };

function profileEmail(p: EntraProfile | undefined): string {
  return (p?.email ?? p?.preferred_username ?? "").trim();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  // Auth.js ต่อ path เหล่านี้กับโดเมนตรง ๆ ไม่รู้จัก basePath ของ Next.js จึงต้องเติม /users เอง
  pages: { signIn: withBasePath("/login"), error: withBasePath("/login") },
  cookies: {
    sessionToken: { name: `${prefix}authjs.session-token`, options: cookieOptions },
    callbackUrl: { name: `${prefix}authjs.callback-url`, options: cookieOptions },
    csrfToken: { name: `${prefix}authjs.csrf-token`, options: cookieOptions },
  },
  callbacks: {
    async signIn({ profile }) {
      const p = profile as EntraProfile | undefined;
      if (!p?.oid) return withBasePath("/login?error=denied");
      const decision = await resolveLogin(profileEmail(p), p.oid);
      return decision.ok ? true : withBasePath(`/login?error=${decision.reason}`);
    },
    async jwt({ token, profile }) {
      // ตอนล็อกอินครั้งแรกของ session: signIn ผูก oid แล้ว จึงอ่าน U_id จาก oid ได้
      const p = profile as EntraProfile | undefined;
      if (p?.oid) {
        const decision = await resolveLogin(profileEmail(p), p.oid);
        token.uid = decision.ok ? decision.userId : undefined;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.uid = token.uid;
      return session;
    },
  },
});

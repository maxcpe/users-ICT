import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { loadActor } from "@/lib/access";
import { isLoginDenyReason, LOGIN_ERROR_TEXT } from "@/lib/login-rules";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const actor = await loadActor();
  if (actor && actor !== "denied") redirect("/");

  const message = isLoginDenyReason(error)
    ? LOGIN_ERROR_TEXT[error]
    : error
      ? "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้ติดต่อผู้ดูแลกลาง"
      : null;

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-6">
      <div className="grid-bg" aria-hidden="true" />
      <main id="main" className="glass above w-full max-w-[440px] px-7 py-8 text-center">
        <div className="logo float mx-auto mb-[18px] !h-[72px] !w-[72px] !rounded-[22px] text-[32px]" aria-hidden="true">U</div>
        <h1 className="h1 !text-[34px]"><span className="text-gradient">ระบบจัดการผู้ใช้</span></h1>
        <p className="lead !mb-[26px]">คณะเทคโนโลยีสารสนเทศและการสื่อสาร<br />มหาวิทยาลัยพะเยา</p>

        {message && (
          <div className="callout callout-bad mb-4 text-left" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{message}</span>
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn btn-primary min-h-[52px] w-full text-base">
            <svg width="20" height="20" viewBox="0 0 23 23" aria-hidden="true">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            {message ? "ใช้บัญชีอื่น" : "เข้าสู่ระบบด้วย Microsoft 365"}
          </button>
        </form>

        <p className="small mt-[18px]">
          สำหรับผู้ดูแลกลางและผู้ดูแลระบบของคณะเท่านั้น
          <br />
          ทุกการเปลี่ยนแปลงถูกบันทึกพร้อมชื่อผู้แก้
        </p>
      </main>
    </div>
  );
}

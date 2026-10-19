import type { Metadata, Viewport } from "next";
import { Kanit, Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});
const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-kanit",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ระบบจัดการผู้ใช้", template: "%s · ระบบจัดการผู้ใช้" },
  description: "จัดการบุคลากรและสิทธิ์ของทุกระบบ คณะเทคโนโลยีสารสนเทศและการสื่อสาร มหาวิทยาลัยพะเยา",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b0718", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${prompt.variable} ${kanit.variable}`}>
      <body>
        
        {children}
      </body>
    </html>
  );
}

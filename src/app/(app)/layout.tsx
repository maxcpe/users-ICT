import { Header } from "@/components/header";
import { requireActor } from "@/lib/access";
import { dbNames } from "@/lib/env";
import { applyDueDeactivations } from "@/lib/lifecycle-service";
import { listSystems } from "@/lib/system-repo";

// ทุกหน้าในกลุ่มนี้ต้องล็อกอินและมีบทบาท อ่านจากฐานทุก request (spec 3.2)
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  // งานตั้งเวลาแบบง่าย: ปิดใช้งานคนที่ถึงวันแล้วทุกครั้งที่มีคนเปิดหน้า (spec 4.5 ปิดใช้งานล่วงหน้า)
  await applyDueDeactivations().catch((e: unknown) => console.error("applyDueDeactivations", e instanceof Error ? e.message : e));
  const systems = await listSystems();
  const mine = systems.filter((s) => actor.systems.includes(s.key)).map((s) => ({ key: s.key, name: s.name }));
  return (
    <>
      <Header actor={actor} systems={mine} />
      <main id="main" className="above mx-auto max-w-[1120px] px-4 pb-16 pt-3">
        {dbNames().userDbReadOnly && (
          <div className="callout callout-warn mb-4" role="status">
            <span aria-hidden="true">🔒</span>
            <span>
              โหมดอ่านข้อมูลจริง (เครื่องพัฒนา): เห็นรายชื่อและสิทธิ์จริง แต่แก้สิทธิ์ของระบบเดิม (คอลัมน์ U_…) ไม่ได้ ·
              ระบบใหม่ ผู้ดูแล และบันทึกการใช้งานบันทึกลงฐาน {dbNames().appDb}
              {dbNames().appDb === dbNames().userDb ? " จริง" : " ไม่กระทบเว็บอื่น"}
            </span>
          </div>
        )}
        {children}
      </main>
    </>
  );
}

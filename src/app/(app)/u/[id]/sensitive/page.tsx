import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdcardPanel } from "@/components/idcard-panel";
import { SensitivePanel } from "@/components/sensitive-panel";
import { CONFIRMED_HMAC_MODE } from "@/lib/idcard";
import { dbNames } from "@/lib/env";
import { maskPhone, maskRfid } from "@/lib/lifecycle-rules";
import { loadPerson } from "@/lib/person";
import { readSensitive } from "@/lib/registry";
import { canSeeSensitive } from "@/lib/roles";
import { IconLock } from "@/components/icons";

export const metadata: Metadata = { title: "ข้อมูลอ่อนไหว" };

// spec 6: ผู้ดูแลกลางเท่านั้น ผู้ดูแลระบบไม่เห็นแม้แต่ว่ามีค่าหรือไม่ (ได้ 404)
export default async function PersonSensitive({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, person } = await loadPerson(id);
  if (!canSeeSensitive(actor)) notFound();
  const s = await readSensitive(person.id);
  if (!s) notFound();

  return (
    <div className="grid max-w-[760px] gap-3.5">
      <div className="callout callout-warn">
        <IconLock />
        <span>เฉพาะผู้ดูแลกลาง · การกด &quot;แสดง&quot; ทุกครั้งถูกบันทึก · ไม่มีการเก็บเลขบัตรประชาชนตัวจริง</span>
      </div>

      <IdcardPanel userId={person.id} hasIdcard={s.hasIdcard} confirmedMode={CONFIRMED_HMAC_MODE} readOnly={dbNames().userDbReadOnly} />

      <SensitivePanel
        userId={person.id}
        masked={{ rfid: maskRfid(s.rfid), tel: maskPhone(s.tel) }}
        readOnly={dbNames().userDbReadOnly}
      />
    </div>
  );
}

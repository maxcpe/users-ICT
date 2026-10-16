import { notFound } from "next/navigation";
import { ClearSystemButton } from "@/components/clear-system-button";
import { MultiRolesSwitch } from "@/components/multi-roles-switch";
import { requireCentral } from "@/lib/access";
import { dbNames } from "@/lib/env";
import { countHolders, countMultiHolders } from "@/lib/registry";
import { getSystem, listSystemAdmins } from "@/lib/system-repo";
import { USERS_SYSTEM_KEY } from "@/lib/systems";
import { SettingsForm } from "./settings-form";

export default async function SystemSettings({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ renamed?: string }>;
}) {
  const { key } = await params;
  const { renamed } = await searchParams;
  await requireCentral();
  const system = await getSystem(key);
  if (!system) notFound();
  const locked = key === USERS_SYSTEM_KEY;
  const [holderCount, admins, multiHolders] = locked
    ? [0, [], 0]
    : await Promise.all([countHolders(system), listSystemAdmins(key), countMultiHolders(system)]);
  const readOnly = dbNames().userDbReadOnly && system.storage === "column";

  return (
    <>
    {renamed && (
      <div className="callout callout-info mb-3.5" role="status">
        <span aria-hidden="true">✓</span>
        <span>เปลี่ยน key เป็น <b className="mono">{key}</b> แล้ว อย่าลืมแจ้งนักพัฒนาของเว็บนี้ให้แก้ key ในโค้ด</span>
      </div>
    )}
    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
      <SettingsForm system={system} locked={locked} />
      {!locked && (
        <section className="glass pad content-start" aria-labelledby="multi">
          <h2 id="multi" className="h2">หลายสิทธิ์ต่อคน</h2>
          <p className="small mb-3 mt-0">
            ให้หนึ่งคนถือได้หลายบทบาทในระบบนี้ (ไม่ต้องซ้อนกันเป็นขั้น) เก็บในตารางกลางแถวละบทบาท
            เว็บต้องเช็กจาก v_roles ว่า &quot;มีบทบาทนี้ไหม&quot; ดูแท็บวิธีเชื่อมต่อ
          </p>
          <MultiRolesSwitch
            systemKey={key}
            systemName={system.name}
            multi={system.multi}
            columnName={system.storage === "column" ? system.columnName : null}
            holders={holderCount}
            multiHolders={multiHolders}
            disabledReason={readOnly ? "โหมดอ่านข้อมูลจริง เปลี่ยนระบบเดิมไม่ได้" : undefined}
          />
        </section>
      )}
      {!locked && (
        <section className="glass pad content-start" style={{ borderColor: "#ff4d6d55" }} aria-labelledby="danger">
          <h2 id="danger" className="h2 !text-bad-ink">ล้างสิทธิ์ทั้งระบบ</h2>
          <p className="small mb-3 mt-0">ตั้งทุกคนเป็น &quot;ไม่มีสิทธิ์&quot; และถอนผู้ดูแลทั้งหมด ใช้เมื่อปิดระบบถาวร ค่าเดิมของทุกคนถูกเก็บในบันทึกการใช้งาน</p>
          <ClearSystemButton
            systemKey={key}
            systemName={system.name}
            holders={holderCount}
            admins={admins.length}
            disabledReason={readOnly ? "โหมดอ่านข้อมูลจริง ล้างสิทธิ์ระบบเดิมไม่ได้" : undefined}
          />
        </section>
      )}
    </div>
    </>
  );
}

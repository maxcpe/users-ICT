import { notFound } from "next/navigation";
import { requireCentral } from "@/lib/access";
import { levelCounts } from "@/lib/registry";
import { getSystem } from "@/lib/system-repo";
import { USERS_SYSTEM_KEY } from "@/lib/systems";
import { confirmLevels } from "../../actions";
import { LevelsForm } from "./levels-form";
import { IconAlert, IconInfo, IconLock } from "@/components/icons";

export default async function SystemLevels({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  await requireCentral();
  const system = await getSystem(key);
  if (!system) notFound();
  const counts = await levelCounts(system);
  const inUse = Object.fromEntries(counts);

  if (key === USERS_SYSTEM_KEY) {
    return (
      <div className="callout callout-info">
        <IconLock />
        <span>ระดับของระบบนี้คงที่ (50 ผู้ดูแลระบบ / 99 ผู้ดูแลกลาง) และตั้งผ่านการแต่งตั้งผู้ดูแลเท่านั้น</span>
      </div>
    );
  }

  return (
    <div className="grid gap-3.5">
      <div className="callout callout-info">
        <IconInfo />
        <span>
          {system.storage === "column"
            ? `ระดับต้องตรงกับที่โค้ดของ${system.name}ตรวจจริง แก้ชื่อเรียกได้ แต่ตัวเลขควรแก้คู่กับผู้พัฒนาระบบนั้น`
            : "ตั้งตัวเลขให้ตรงกับที่โค้ดของเว็บนี้ใช้เทียบ แนะนำให้เว็บเทียบด้วย >= เช่น ผู้ดูแล = level >= 99"}
        </span>
      </div>
      {system.unconfirmed && (
        <div className="callout callout-warn flex-wrap">
          <IconAlert />
          <span className="flex-1">ยังไม่ยืนยันความหมายของระดับกับเจ้าของระบบ ตั้งชื่อให้ตรงก่อนแล้วกดยืนยัน</span>
          <form
            action={async () => {
              "use server";
              await confirmLevels(key);
            }}
          >
            <button type="submit" className="btn btn-sm">ยืนยันระดับแล้ว</button>
          </form>
        </div>
      )}
      <LevelsForm systemKey={key} levels={system.levels} inUse={inUse} />
      {[...counts].some(([v, n]) => n > 0 && !system.levels.some((l) => l.value === v)) && (
        <div className="callout callout-warn">
          <IconAlert />
          <span>
            มีค่าที่ไม่อยู่ในรายการ:{" "}
            {[...counts]
              .filter(([v]) => !system.levels.some((l) => l.value === v))
              .map(([v, n]) => `${v} (${n} คน)`)
              .join(", ")}{" "}
            เพิ่มเป็นระดับได้ถ้าค่านั้นมีความหมายจริง
          </span>
        </div>
      )}
    </div>
  );
}

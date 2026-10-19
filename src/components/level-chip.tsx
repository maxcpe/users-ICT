import { describeLevel, type Level } from "@/lib/systems";
import { IconAlert } from "@/components/icons";

const ROTATE = ["chip-pink", "chip-cyan", "chip-violet"] as const;

/** สีของระบบสลับตาม sort_order ให้คนจำได้ (design.md 5.5) */
export function systemChipClass(index: number): string {
  return ROTATE[index % ROTATE.length]!;
}

/** ป้าย "ระบบ · ระดับ" หรือแค่ระดับ ถ้าไม่ส่ง systemName */
export function LevelChip({
  levels,
  value,
  systemName,
  colorIndex = 0,
}: {
  levels: Level[];
  value: number | null | undefined;
  systemName?: string;
  colorIndex?: number;
}) {
  const d = describeLevel(levels, value);
  const prefix = systemName ? `${systemName} · ` : "";
  if (d.kind === "none") return <span className="chip chip-off">{prefix}ไม่มีสิทธิ์</span>;
  if (d.kind === "other")
    return (
      <span className="chip chip-warn" title="ค่าไม่อยู่ในระดับที่ลงทะเบียน อาจมีคนแก้ในฐานข้อมูลตรง">
        <IconAlert /> {prefix}ค่าอื่น ({d.value})
      </span>
    );
  return (
    <span className={`chip ${systemChipClass(colorIndex)}`}>
      {prefix}
      {d.label}
    </span>
  );
}

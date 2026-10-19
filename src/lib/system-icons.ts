// ไอคอนของแต่ละระบบ (design.md 5.18) — เก็บเป็นชื่อในคอลัมน์ systems.icon ไม่ใช่อีโมจิ
// ไม่แตะ React เพื่อให้ server action ตรวจค่าได้ และ test ได้

export const SYSTEM_ICONS = [
  { key: "clipboard-check", label: "แบบประเมิน" },
  { key: "clock", label: "เวลา" },
  { key: "bus", label: "รถ" },
  { key: "car", label: "รถยนต์" },
  { key: "presentation", label: "ห้องประชุม" },
  { key: "building", label: "อาคาร" },
  { key: "book-open", label: "หนังสือ" },
  { key: "library", label: "ห้องสมุด" },
  { key: "ticket", label: "ลงทะเบียน" },
  { key: "trophy", label: "รางวัล" },
  { key: "award", label: "เกียรติบัตร" },
  { key: "notebook-pen", label: "บันทึก" },
  { key: "chart-column", label: "สถิติ" },
  { key: "brain-circuit", label: "AI" },
  { key: "graduation-cap", label: "การศึกษา" },
  { key: "users", label: "บุคลากร" },
  { key: "shield-check", label: "ความปลอดภัย" },
  { key: "file-text", label: "เอกสาร" },
  { key: "briefcase", label: "งาน" },
  { key: "calendar", label: "ปฏิทิน" },
  { key: "flask", label: "วิจัย" },
  { key: "laptop", label: "คอมพิวเตอร์" },
  { key: "mail", label: "จดหมาย" },
  { key: "megaphone", label: "ประกาศ" },
  { key: "wallet", label: "การเงิน" },
  { key: "box", label: "ทั่วไป" },
] as const;

export type SystemIconKey = (typeof SYSTEM_ICONS)[number]["key"];
export const DEFAULT_SYSTEM_ICON: SystemIconKey = "box";
export const SYSTEM_ICON_KEYS = SYSTEM_ICONS.map((i) => i.key) as [SystemIconKey, ...SystemIconKey[]];

export function isSystemIconKey(v: unknown): v is SystemIconKey {
  return typeof v === "string" && (SYSTEM_ICON_KEYS as readonly string[]).includes(v);
}

/** อีโมจิเดิม (ก่อน 19 ต.ค. 2569) → ไอคอนที่ความหมายใกล้กัน ใช้ตอนย้ายข้อมูล */
export const EMOJI_TO_ICON: Record<string, SystemIconKey> = {
  "📝": "clipboard-check",
  "⏰": "clock",
  "🚐": "bus",
  "🏢": "presentation",
  "📚": "book-open",
  "📖": "library",
  "🎟️": "ticket",
  "🏆": "trophy",
  "🎭": "notebook-pen",
  "📊": "chart-column",
  "🛡️": "shield-check",
  "🗂️": "file-text",
  "📦": "box",
  "💻": "laptop",
  "🔬": "flask",
  "🧾": "file-text",
  "📅": "calendar",
};

// ไอคอนของหน้าจอ (design.md 5.18) — ชุดเดียว Lucide เส้นเดียวกันทั้งระบบ แทนอีโมจิ/อักขระพิเศษ
// ไอคอนประกอบข้อความเสมอ จึง aria-hidden (ข้อความข้าง ๆ บอกความหมายแล้ว)
import {
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  Hourglass,
  Info,
  LayoutGrid,
  List,
  Lock,
  Moon,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Undo2,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

function make(Icon: LucideIcon) {
  function AppIcon({ className = "" }: { className?: string }) {
    return <Icon aria-hidden="true" focusable="false" strokeWidth={2} className={`ic ${className}`.trim()} />;
  }
  return AppIcon;
}

export const IconAlert = make(TriangleAlert);
export const IconCheck = make(Check);
export const IconDown = make(ChevronDown);
export const IconUp = make(ChevronUp);
export const IconGlobe = make(Globe);
export const IconHourglass = make(Hourglass);
export const IconInfo = make(Info);
export const IconGrid = make(LayoutGrid);
export const IconList = make(List);
export const IconLock = make(Lock);
export const IconMoon = make(Moon);
export const IconPlus = make(Plus);
export const IconShield = make(ShieldCheck);
export const IconUndo = make(Undo2);
export const IconWrench = make(Wrench);
export const IconX = make(X);

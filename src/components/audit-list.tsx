import type { AuditLog } from "@/generated/prisma/client";
import type { SystemDef } from "@/lib/registry";
import { describeLevel } from "@/lib/systems";

const ACTION_TEXT: Record<string, { label: string; chip: string }> = {
  "user.create": { label: "เพิ่มบุคลากร", chip: "chip-ok" },
  "user.update": { label: "แก้ข้อมูล", chip: "chip-cyan" },
  "user.deactivate": { label: "ปิดใช้งาน", chip: "chip-pink" },
  "user.reactivate": { label: "เปิดใช้งานอีกครั้ง", chip: "chip-ok" },
  "user.delete": { label: "ลบแถว", chip: "chip-pink" },
  "sensitive.view": { label: "🔒 แสดงข้อมูล", chip: "chip-warn" },
  "sensitive.update": { label: "🔒 แก้ข้อมูลอ่อนไหว", chip: "chip-warn" },
  "sensitive.check": { label: "🔒 ตรวจคีย์เลขบัตร", chip: "chip-warn" },
  "role.set": { label: "ตั้งสิทธิ์", chip: "chip-violet" },
  "admin.assign": { label: "แต่งตั้งผู้ดูแล", chip: "chip-cyan" },
  "admin.revoke": { label: "ถอนผู้ดูแล", chip: "chip-pink" },
  "system.create": { label: "ลงทะเบียนระบบ", chip: "chip-ok" },
  "system.update": { label: "แก้ข้อมูลระบบ", chip: "chip-cyan" },
  "system.levels": { label: "แก้ระดับสิทธิ์", chip: "chip-cyan" },
  "system.confirm": { label: "ยืนยันระดับ", chip: "chip-ok" },
  "system.clear": { label: "ล้างสิทธิ์ทั้งระบบ", chip: "chip-pink" },
  "system.rename": { label: "เปลี่ยน key", chip: "chip-warn" },
  "system.multi": { label: "หลายสิทธิ์ต่อคน", chip: "chip-warn" },
};

const FIELD_TEXT: Record<string, string> = {
  name: "ชื่อ",
  icon: "ไอคอน",
  url: "ลิงก์",
  note: "หมายเหตุ",
  active: "แสดงในหน้าจอ",
  email: "อีเมล",
  position: "ตำแหน่ง",
  branch: "สังกัด",
  job: "งาน",
};

const dateFmt = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
const timeFmt = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

function levelText(s: SystemDef | undefined, v: unknown): string {
  if (v === null || v === undefined) return "ไม่มีสิทธิ์";
  const n = Number(v);
  if (!s) return String(n);
  const d = describeLevel(s.levels, n);
  return d.kind === "known" ? d.label : `ค่าอื่น (${n})`;
}

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "ใช่" : "ไม่") : String(v));

function Diff({ entry, system }: { entry: AuditLog; system?: SystemDef }) {
  const c = (entry.changes ?? {}) as Record<string, unknown>;
  // ระบบหลายสิทธิ์ (spec 2.3): { levels: [[เดิม…], [ใหม่…]] }
  if (entry.action === "role.set" && Array.isArray(c.levels)) {
    const set = (v: unknown) => (Array.isArray(v) && v.length ? v.map((x) => levelText(system, x)).join(", ") : "ไม่มีสิทธิ์");
    return (
      <div className="small">
        <s className="text-bad-ink">{set(c.levels[0])}</s> → <span className="text-ok-ink">{set(c.levels[1])}</span>
      </div>
    );
  }
  if (entry.action === "role.set" && Array.isArray(c.level)) {
    return (
      <div className="small">
        <s className="text-bad-ink">{levelText(system, c.level[0])}</s> → <span className="text-ok-ink">{levelText(system, c.level[1])}</span>
      </div>
    );
  }
  if (entry.action === "system.update" || entry.action === "user.update") {
    return (
      <div className="small">
        {Object.entries(c).map(([k, v]) =>
          Array.isArray(v) ? (
            <div key={k}>
              {FIELD_TEXT[k] ?? k}: <s className="text-bad-ink">{show(v[0])}</s> → <span className="text-ok-ink">{show(v[1])}</span>
            </div>
          ) : null,
        )}
      </div>
    );
  }
  if (entry.action === "system.levels" && Array.isArray(c.levels)) {
    const fmt = (ls: unknown) => (Array.isArray(ls) ? ls.map((l: { value: number; label: string }) => `${l.value} ${l.label}`).join(" · ") : "");
    return (
      <div className="small">
        <s className="text-bad-ink">{fmt(c.levels[0])}</s> → <span className="text-ok-ink">{fmt(c.levels[1])}</span>
      </div>
    );
  }
  if (c.source === "seed") return <div className="small">ค่าเริ่มต้นจากคนที่มีค่า 99</div>;
  if (entry.action === "user.deactivate") {
    return <div className="small">เหตุผล: {show(c.reason)} · มีผล {show(c.effectiveDate)}{c.scheduled ? " (ตั้งล่วงหน้า)" : ""}</div>;
  }
  if (entry.action === "user.reactivate") {
    const n = c.restored && typeof c.restored === "object" ? Object.keys(c.restored).length : 0;
    return <div className="small">{c.cancelScheduled ? "ยกเลิกการปิดล่วงหน้า" : `คืนสิทธิ์ ${n} ระบบ`}</div>;
  }
  if (entry.action === "sensitive.view" || entry.action === "sensitive.update" || entry.action === "sensitive.check") {
    const f = Object.keys(c)[0];
    return <div className="small">{f === "U_rfid" ? "RFID" : f === "U_tel" ? "เบอร์โทร" : "เลขบัตรประชาชน"} · ไม่แสดงค่า</div>;
  }
  if (entry.action === "system.rename" && Array.isArray(c.key)) {
    return (
      <div className="small mono">
        <s className="text-bad-ink">{show(c.key[0])}</s> → <span className="text-ok-ink">{show(c.key[1])}</span>
      </div>
    );
  }
  if (entry.action === "system.multi") {
    const n = c.moved && typeof c.moved === "object" ? Object.keys(c.moved).length : 0;
    return (
      <div className="small">
        {c.multi ? `เปิดหลายสิทธิ์ต่อคน${c.fromColumn ? ` · ย้าย ${n} คนจาก ${show(c.fromColumn)} ไปตารางกลาง (ค่าเดิมเก็บไว้ในบันทึกนี้)` : ""}` : "ปิดหลายสิทธิ์ต่อคน"}
      </div>
    );
  }
  if (entry.action === "system.clear") {
    const n = c.before && typeof c.before === "object" ? Object.keys(c.before).length : 0;
    return <div className="small">ล้างสิทธิ์ {n} คน (ค่าเดิมเก็บไว้ในบันทึกนี้)</div>;
  }
  return null;
}

/** บันทึกการใช้งาน (design.md 5.15) */
export function AuditList({
  entries,
  names,
  systems,
  hideTarget = false,
}: {
  entries: AuditLog[];
  names: Map<number, string>;
  systems: Map<string, SystemDef>;
  hideTarget?: boolean;
}) {
  if (entries.length === 0) return <div className="glass pad text-center text-muted">ยังไม่มีบันทึก</div>;
  return (
    <ol className="glass m-0 list-none p-0">
      {entries.map((e) => {
        const a = ACTION_TEXT[e.action] ?? { label: e.action, chip: "chip-off" };
        const system = e.systemKey ? systems.get(e.systemKey) : undefined;
        const who = (id: number | null) => (id === null ? null : (names.get(id) ?? `U_id ${id}`));
        return (
          <li key={String(e.id)} className="grid gap-x-4 gap-y-1 border-[#ffffff14] px-4 py-3.5 min-[821px]:grid-cols-[110px_1fr] [&+&]:border-t">
            <time dateTime={e.at.toISOString()} className="small">
              {dateFmt.format(e.at)}
              <br className="max-[820px]:hidden" /> {timeFmt.format(e.at)}
            </time>
            <div>
              <span className={`chip ${a.chip}`}>{a.label}</span>{" "}
              {!hideTarget && e.targetId !== null && <b>{who(e.targetId)}</b>}
              {system && <> · {system.name}</>}
              {!system && e.systemKey && <> · {e.systemKey}</>} <span className="small">โดย {who(e.actorId)}</span>
              <Diff entry={e} system={system} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

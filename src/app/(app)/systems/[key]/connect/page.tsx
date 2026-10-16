import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { requireActor } from "@/lib/access";
import { canViewSystem } from "@/lib/roles";
import { getSystem } from "@/lib/system-repo";

export default async function SystemConnect({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { key } = await params;
  const { created } = await searchParams;
  const actor = await requireActor();
  const system = await getSystem(key);
  if (!system || !canViewSystem(actor, key)) notFound();

  // spec 8.1: เว็บบนเซิร์ฟเวอร์เดียวกันอ่าน view ด้วยบัญชี ro_<key> ของตัวเอง
  const sql = `SELECT U_id, U_name, level
FROM \`user\`.\`v_roles\`
WHERE system_key = '${key}' AND U_email = ?;
-- ไม่ได้แถว = ไม่มีสิทธิ์ · คนที่ปิดใช้งานไม่อยู่ใน view${system.multi ? "\n-- หลายสิทธิ์ต่อคน: ได้ 1 แถวต่อบทบาท เช็กว่ามีแถว level = ที่ต้องการไหม" : ""}`;
  const grant = `CREATE USER 'ro_${key}'@'localhost' IDENTIFIED BY '<รหัสผ่าน>';
GRANT SELECT ON \`user\`.\`v_roles\` TO 'ro_${key}'@'localhost';
GRANT SELECT ON \`user\`.\`v_staff\` TO 'ro_${key}'@'localhost';`;

  return (
    <div className="grid gap-3.5">
      {created && (
        <div className="callout callout-info" role="status">
          <span aria-hidden="true">✓</span>
          <span>ลงทะเบียน{system.name}แล้ว ส่ง SQL ด้านล่างให้นักพัฒนาของเว็บนี้ และขอบัญชีฐานข้อมูลจากผู้พัฒนา</span>
        </div>
      )}
      <div className="callout callout-info">
        <span aria-hidden="true">ℹ️</span>
        <span>
          {system.multi
            ? `${system.name}เปิดหลายสิทธิ์ต่อคน: แต่ละคนอาจได้หลายแถว (แถวละบทบาท) เว็บต้องเช็ก "มีบทบาทนี้ไหม" ไม่ใช่เทียบระดับเดียว`
            : system.storage === "column"
              ? `${system.name}อ่านสิทธิ์จากที่เดิมได้ตามปกติ ไม่ต้องแก้ ถ้าต้องการเปลี่ยนมาอ่าน view ด้านล่างก็ทำได้โดยไม่ต้องย้ายข้อมูล`
              : "ระบบนี้เก็บสิทธิ์ในตารางกลาง ให้เว็บอ่านผ่าน view ด้านล่าง ห้ามอ่านหรือเขียนตาราง user_roles ตรง"}
        </span>
      </div>

      <section className="glass pad" aria-labelledby="read-sql">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <h2 id="read-sql" className="h2 !m-0">อ่านสิทธิ์ของผู้ใช้ (เว็บบนเซิร์ฟเวอร์เดียวกัน)</h2>
          <CopyButton text={sql} />
        </div>
        <pre className="code">
          <code>
            {`SELECT U_id, U_name, level\nFROM \`user\`.\`v_roles\`\nWHERE system_key = `}
            <span className="k">{`'${key}'`}</span>
            {` AND U_email = ?;\n`}
            <span className="c">-- ไม่ได้แถว = ไม่มีสิทธิ์ · คนที่ปิดใช้งานไม่อยู่ใน view</span>
            {system.multi && <span className="c">{"\n-- หลายสิทธิ์ต่อคน: ได้ 1 แถวต่อบทบาท เช็กว่ามีแถว level = ที่ต้องการไหม"}</span>}
          </code>
        </pre>
        <dl className="kv mt-4">
          <dt>key ของระบบ</dt>
          <dd><code className="text-pink-ink">{key}</code></dd>
          <dt>บัญชีฐานข้อมูล</dt>
          <dd><code>ro_{key}</code> <span className="small">ผู้พัฒนาสร้างให้ อ่านได้แค่ v_roles และ v_staff</span></dd>
          <dt>ระดับ</dt>
          <dd>{system.levels.map((l) => `${l.value} ${l.label}`).join(" · ") || "ยังไม่ได้กำหนด"}</dd>
          <dt>คำแนะนำ</dt>
          <dd>
            อ่านสิทธิ์ทุก request หรือ cache ไม่เกิน 5 นาที
            {system.multi ? " เช็กว่ามีแถวของบทบาทที่ต้องการ (ไม่ต้องซ้อนกัน)" : " เทียบระดับด้วย >="} และอ้างอิงคนด้วย U_id ไม่ใช่อีเมล
          </dd>
        </dl>
      </section>

      <section className="glass pad" aria-labelledby="grant-sql">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <h2 id="grant-sql" className="h2 !m-0">สร้างบัญชีฐานข้อมูลของเว็บ (ผู้พัฒนาทำ)</h2>
          <CopyButton text={grant} />
        </div>
        <pre className="code"><code>{grant}</code></pre>
      </section>

      <div className="callout callout-info">
        <span aria-hidden="true">🌐</span>
        <span>เว็บที่อยู่นอกเซิร์ฟเวอร์นี้ใช้ API อ่านอย่างเดียวแทน ยังไม่เปิด จะทำเมื่อมีเว็บแบบนี้ (spec 8.2)</span>
      </div>
    </div>
  );
}

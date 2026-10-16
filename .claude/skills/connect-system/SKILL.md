---
name: connect-system
description: เชื่อมเว็บของคณะ ICT เข้ากับระบบจัดการผู้ใช้ ให้เว็บนั้นอ่านสิทธิ์ผู้ใช้ผ่าน view `user`.`v_roles` (เว็บบนเซิร์ฟเวอร์เดียวกัน) หรือ API อ่านอย่างเดียว (เว็บที่อยู่เครื่องอื่น) ใช้เมื่อสร้างเว็บใหม่ที่ต้องมีการล็อกอินหรือสิทธิ์ผู้ดูแล เมื่อลงทะเบียนเว็บใหม่ในหน้า /users/systems หรือเมื่อย้ายเว็บเดิมจากคอลัมน์ U_xxx
---

# เชื่อมเว็บเข้ากับระบบจัดการผู้ใช้

เว็บใหม่ไม่ต้องเพิ่มคอลัมน์ใน `user`.`user` และ**ห้ามอ่าน `user`.`user` หรือ `user`.`user_roles` ตรง** ให้อ่านผ่านช่องทางด้านล่าง (spec หัวข้อ 8.1–8.2)

## 1. ลงทะเบียนเว็บ (ผู้ดูแลกลางทำในหน้าจอ)
ที่ `https://service.ict.up.ac.th/users/systems` → เพิ่มระบบ
- **key**: ตัวพิมพ์เล็ก a–z ตัวเลข และ `_` เช่น `library` **ตั้งแล้วแก้ไม่ได้** เพราะโค้ดของเว็บใช้ค่านี้
- **ระดับ**: ตัวเลขคู่กับชื่อ เช่น `1 ผู้ใช้ / 99 ผู้ดูแล` ใช้ 99 เป็นผู้ดูแลให้เหมือนเว็บอื่น
- แต่งตั้งผู้ดูแลของเว็บ เพื่อให้เขาตั้งสิทธิ์ผู้ใช้ของเว็บตัวเองได้

## 2. เลือกช่องทาง
| เว็บอยู่ที่ไหน | ใช้ | ต้องขออะไร |
|---|---|---|
| SVR-ICT-SERVICE เครื่องเดียวกับ MySQL | view `user`.`v_roles` | บัญชี MySQL `ro_<key>` จากผู้พัฒนา |
| เครื่องอื่น | API อ่านอย่างเดียว | API key จากผู้ดูแลกลาง (แท็บวิธีเชื่อมต่อ) |

ถ้าอยู่เครื่องเดียวกัน ให้ใช้ view เสมอ เพราะไม่พึ่งระบบจัดการผู้ใช้ ถ้าระบบนั้นล่ม เว็บยังล็อกอินได้

## 3A. อ่านผ่าน view (เซิร์ฟเวอร์เดียวกัน)
```sql
SELECT U_id, U_name, level
FROM `user`.`v_roles`
WHERE system_key = ? AND U_email = ?;
```
- parameter แรกคือ key ของเว็บ parameter ที่สองคืออีเมลจาก 365 ที่ trim และแปลงเป็นตัวพิมพ์เล็กแล้ว (`U_email` ใน view ทำให้แล้ว)
- **ไม่ได้แถว = ไม่มีสิทธิ์** ใน view ไม่มีคนที่ปิดใช้งานและนักศึกษา ไม่ต้องกรองเอง
- เทียบระดับด้วย `>=` เช่น ผู้ดูแล = `level >= 99` จะเพิ่มระดับกลางทีหลังได้โดยไม่ต้องแก้โค้ด
- ถ้าฝั่งผู้ใช้เปิดให้บุคลากรทุกคน ให้เช็กว่าเป็นบุคลากรจาก `user`.`v_staff` (มีแถว = บุคลากรที่ใช้งานอยู่) แล้วค่อยดูระดับจาก `v_roles`
- อ่านสิทธิ์ทุก request หรือ cache ไม่เกิน 5 นาที ห้ามเก็บสิทธิ์ใน JWT ที่อายุยาว

ตัวอย่าง TypeScript (mysql2):
```ts
const SYSTEM_KEY = "library";

export async function getRole(email: string) {
  const [rows] = await pool.execute(
    "SELECT U_id, U_name, level FROM `user`.`v_roles` WHERE system_key = ? AND U_email = ? LIMIT 1",
    [SYSTEM_KEY, email.trim().toLowerCase()],
  );
  return (rows as { U_id: number; U_name: string; level: number }[])[0] ?? null;
}
```

บัญชีฐานข้อมูล (ผู้พัฒนาสร้าง ครั้งละเว็บ):
```sql
CREATE USER 'ro_<key>'@'localhost' IDENTIFIED BY '<รหัสผ่าน>';
GRANT SELECT ON `user`.`v_roles` TO 'ro_<key>'@'localhost';
GRANT SELECT ON `user`.`v_staff` TO 'ro_<key>'@'localhost';
```
รหัสผ่านเก็บใน `.env` ของเว็บนั้น ห้ามใช้บัญชี `ictservice` ร่วมกับเว็บอื่น

## 3B. อ่านผ่าน API (เครื่องอื่น)
```
GET https://service.ict.up.ac.th/users/api/v1/roles?email=<อีเมล>
Authorization: Bearer <API key>
```
- `200` → มีสิทธิ์ ได้ `{ U_id, name, position, branch, level, label }`
- `404` → ไม่มีสิทธิ์ (รวมถึงไม่มีบัญชีหรือปิดใช้งานแล้ว)
- `401` → key ผิดหรือถูกยกเลิก
- `429` → เรียกเกิน 60 ครั้งต่อนาที

ข้อควรทำ:
- key ผูกกับเว็บเดียว เก็บใน `.env` ฝั่ง server เท่านั้น ห้ามส่งไปเบราว์เซอร์
- cache ผลไม่เกิน 5 นาที ถ้า API ตอบไม่ได้และไม่มี cache ให้แจ้งผู้ใช้ลองใหม่ **ห้ามปล่อยเข้าโดยไม่ได้เช็ก**
- เปลี่ยน key: ขอ key ใหม่ ใส่ในเว็บ deploy แล้วค่อยให้ผู้ดูแลกลางยกเลิก key เก่า

```ts
const r = await fetch(
  `https://service.ict.up.ac.th/users/api/v1/roles?email=${encodeURIComponent(email.trim().toLowerCase())}`,
  { headers: { Authorization: `Bearer ${process.env.USERS_API_KEY}` }, signal: AbortSignal.timeout(3000) },
);
if (r.status === 404) return null;            // ไม่มีสิทธิ์
if (!r.ok) throw new Error(`users api ${r.status}`); // ให้ผู้ใช้ลองใหม่
return (await r.json()) as { U_id: number; name: string; level: number; label: string };
```

## 4. สิ่งที่เว็บห้ามทำ
- เขียนลง `user`.`user` หรือ `user_roles` เอง การเพิ่มคนและการตั้งสิทธิ์ทำผ่านระบบจัดการผู้ใช้เท่านั้น จะได้มี audit log
- อ้างอิงคนด้วยอีเมลในฐานข้อมูลของเว็บ ให้ใช้ `U_id` เพราะอีเมลเปลี่ยนได้

สิทธิ์ที่ละเอียดกว่าระดับเดียว เช่น "ใครเห็นรายการไหน" ให้เก็บในฐานของเว็บนั้นเอง โดยอ้างอิงคนด้วย `U_id`

## ย้ายเว็บเดิมจากคอลัมน์ U_xxx (ไม่บังคับ)
`v_roles` มีข้อมูลจากคอลัมน์เดิมอยู่แล้ว การย้ายจึงแบ่งได้สองขั้น:
1. **เปลี่ยนแค่ที่อ่าน** แก้โค้ดของเว็บให้อ่าน `v_roles` ด้วย key ของตัวเองแทนคอลัมน์ ข้อมูลยังอยู่ที่เดิม ทำได้ทันที
2. **ย้ายที่เก็บ** (ทำทีหลังได้) ตามลำดับนี้:
   1. คัดลอกค่าเข้า `user_roles`
      ```sql
      INSERT INTO `user`.`user_roles` (U_id, system_key, level)
      SELECT U_id, '<key>', `U_xxx` FROM `user`.`user` WHERE `U_xxx` IS NOT NULL;
      ```
   2. ลบส่วน `UNION ALL` ของคอลัมน์นั้นออกจาก `v_roles` ใน transaction เดียวกับข้อ 1 ไม่งั้นจะได้แถวซ้ำ
   3. ผู้ดูแลกลางเปลี่ยน `storage` ของเว็บนั้นเป็น `table`
   4. **คอลัมน์เดิมเก็บไว้ ห้ามลบ** จะไม่ถูกอัปเดตอีก

ระหว่างขั้นที่ 2 ห้ามแก้สิทธิ์ของเว็บนั้น เพราะค่าในสองที่จะไม่ตรงกัน

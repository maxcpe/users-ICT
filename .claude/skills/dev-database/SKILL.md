---
name: dev-database
description: ใช้และรีเซ็ตฐานข้อมูลสำหรับพัฒนาของระบบจัดการผู้ใช้ (user_dev และ usermanagement_dev บนเซิร์ฟเวอร์ MySQL) และโหลด sql/dev-seed.sql ใช้เมื่อต้องรันแอปหรือ test ที่ต้องใช้ฐานข้อมูล เมื่อเชื่อมต่อฐานพัฒนาไม่ได้ เมื่อแก้ dev-seed.sql หรือเมื่อตั้งค่า .env สำหรับพัฒนา
---

# ฐานข้อมูลสำหรับพัฒนา

ฐานพัฒนาอยู่บนเซิร์ฟเวอร์ MySQL **เครื่องเดียวกับฐานจริง** (spec หัวข้อ 11.5) จึงต้องระวังเป็นพิเศษ

| ฐาน | ใช้แทน | สร้างจาก |
|---|---|---|
| `user_dev` | `user` | `sql/dev-seed.sql` |
| `usermanagement_dev` | `usermanagement` | `npx prisma migrate dev` |

## กฎที่ห้ามพลาด
- **ห้ามแตะฐาน `user` และ `usermanagement` ระหว่างพัฒนา** ทั้งอ่านและเขียน ถ้าเจอ connection string, `USER_DB`, `APP_DB` หรือคำสั่ง SQL ที่ชี้ไปที่ฐานจริง ให้หยุดแล้วบอกผู้ใช้ทันที
- ใช้บัญชี `usermanagement_dev` ซึ่งไม่มีสิทธิ์บนฐานจริงเลย ถ้าคำสั่งไหนได้ error "access denied" กับฐาน `user` แปลว่าตัวกันทำงานถูกแล้ว ห้ามแก้ด้วยการขอสิทธิ์เพิ่ม
- ห้ามแก้ชื่อฐานใน `dev-seed.sql` เป็นฐานจริง สคริปต์นี้ DROP ตาราง
- ห้ามเอาข้อมูลจริงมาใส่ฐานพัฒนา แม้จะ copy มาจากเครื่องเดียวกันก็ตาม

## `.env` สำหรับพัฒนา
```
DATABASE_URL=mysql://usermanagement_dev:<password>@<host>:3306/usermanagement_dev
```
- ไม่ต้องตั้ง `USER_DB` / `APP_DB`: ระบบใช้ชื่อฐานท้าย `DATABASE_URL` และใช้ `user_dev` เป็นฐานทะเบียนผู้ใช้ตอนพัฒนา
- ถ้าโหมดพัฒนาแล้วฐานใดไม่ลงท้ายด้วย `_dev` แอป, migrate และ seed จะหยุดทำงานเอง (src/lib/env.ts, spec 11.5)
- ค่าใน `.env` ห้ามพิมพ์ลงแชตหรือ commit ถ้าต้องตรวจค่า ให้ตรวจแค่ว่าชื่อฐานลงท้ายด้วย `_dev`

## โหมดอ่านข้อมูลจริง (ผู้ใช้เลือกใช้ 9 ต.ค. 2569)
อ่านรายชื่อและสิทธิ์จริงจากฐาน `user` แต่เขียนไม่ได้ (spec 11.5)
- ตั้งค่าด้วย `sql/readonly-setup.sql` (บัญชี admin รันครั้งเดียว) แล้วใน `.env`: `DATABASE_URL=…/usermanagement_dev`, `USER_DB=user`, `USER_DB_READONLY=yes`
- `user_roles` อยู่ใน `usermanagement_dev` · การเขียน `user`.`user` โยน `ReadOnlyUserDbError`
- ตอนเริ่มแอปเช็ก `SHOW GRANTS` ถ้าบัญชีแก้ฐาน `user` ได้แอปจะหยุด **ห้ามแก้ตัวเช็กนี้ให้ผ่าน** ให้แก้สิทธิ์ของบัญชีแทน
- ห้ามรัน `sql/dev-seed.sql` ในโหมดนี้ (ไม่ต้องใช้)

## ตั้งครั้งแรก (ผู้ที่มีสิทธิ์ admin บน MySQL ทำ)
```sql
-- dev-seed.sql สร้างฐาน user_dev และ usermanagement_dev ให้เอง
CREATE USER 'usermanagement_dev'@'%' IDENTIFIED BY '<รหัสผ่าน>';
GRANT ALL PRIVILEGES ON `usermanagement_dev`.* TO 'usermanagement_dev'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `user_dev`.* TO 'usermanagement_dev'@'%';
-- ไม่มี GRANT ใดๆ บนฐาน user หรือ usermanagement
```
ถ้าพัฒนาจากเครื่องอื่นที่ไม่ใช่เซิร์ฟเวอร์ ให้จำกัด host ของบัญชีเป็น IP ของเครื่องพัฒนาแทน `'%'`

## โหลด / รีเซ็ตข้อมูล
`dev-seed.sql` จะ DROP แล้วสร้างตาราง `user` และ `user_roles` ใน `user_dev` ใหม่ สคริปต์มีตัวกันที่หยุดทำงานถ้าฐานที่เลือกอยู่ไม่ใช่ `user_dev`

ให้ผู้ใช้รันเองผ่าน Navicat หรือ `mysql` client ด้วยบัญชีที่สร้างฐานได้ ก่อนรันให้บอกผู้ใช้ทุกครั้งว่าคำสั่งนี้จะลบข้อมูลใน `user_dev` ทั้งหมด

จากนั้นสร้างตารางของแอปและค่าเริ่มต้น:
```
npm run db:migrate   # prisma migrate deploy
npm run db:seed      # prisma db seed
```
view `v_roles` / `v_staff` อยู่ที่ `sql/views.sql` (ฐาน `user` จริง) ให้ผู้ใช้รันด้วยบัญชี admin หลัง migrate
- `db:seed` ใส่ทะเบียนระบบ (รวมระบบสมมติ `library` เฉพาะฐาน `_dev`) และผู้ดูแลเริ่มต้นจากคนที่มีค่า 99 รันซ้ำได้ ไม่ทับค่าที่แก้ไว้

## แก้ schema.prisma
**ห้ามใช้ `prisma migrate dev`** เพราะต้องสร้าง shadow database ซึ่งบัญชี `_dev` ไม่มีสิทธิ์ (และไม่ควรมีบนเซิร์ฟเวอร์ที่ใช้ร่วมกัน) ให้สร้าง migration แบบ offline แทน:
```
# 1. สร้างโฟลเดอร์ prisma/migrations/<YYYYMMDDHHMMSS>_<ชื่อ>/
# 2. สร้าง SQL จากความต่างระหว่าง migration เดิมกับ schema ใหม่
#    (ต้องมี DATABASE_URL ในสภาพแวดล้อม ไม่งั้นได้ไฟล์ว่างโดยไม่มี error
#     และฐานใน DATABASE_URL ต้องลงท้ายด้วย _dev ไม่งั้น prisma.config.ts จะหยุดทำงาน)
npx prisma migrate diff --from-migrations=prisma/migrations --to-schema=prisma/schema.prisma --script -o prisma/migrations/<โฟลเดอร์>/migration.sql
# 3. อ่าน SQL ที่ได้ก่อนเสมอ แล้วค่อย npm run db:migrate
```
เช็กทุกครั้งว่าไฟล์ migration ไม่ว่าง

## แก้ dev-seed.sql
- โครงสร้างตาราง `user` ต้องตรงกับเซิร์ฟเวอร์ทุกคอลัมน์ รวม charset/collation ถ้าโครงสร้างจริงเปลี่ยน ให้ขอผู้ใช้ export แบบ "Structure only" มาเทียบ
- ข้อมูลเป็นข้อมูลสมมติเท่านั้น ยกเว้นแถว `U_id` = 1 ที่ใช้อีเมลของผู้พัฒนาเพื่อล็อกอิน 365
- เพิ่มกรณีพิเศษเมื่อเจอปัญหาจากข้อมูลจริง เช่น อีเมลมีช่องว่าง, `''` แทน `NULL`, ค่าสิทธิ์แปลก พร้อมเขียน comment อธิบาย
- ทุกแถวใน `INSERT INTO user` ต้องมี 18 ค่าตามรายการคอลัมน์

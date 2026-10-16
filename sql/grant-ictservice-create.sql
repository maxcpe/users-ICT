-- ให้ ictservice สร้างตารางของระบบจัดการผู้ใช้ในฐาน `user` ได้ (เลือกใช้ 9 ต.ค. 2569)
-- รันด้วยบัญชี admin ของ MySQL ครั้งเดียว
--
-- คำเตือน: ทุกเว็บของคณะใช้ ictservice ร่วมกัน หลังรันไฟล์นี้ทุกเว็บจะสร้าง/แก้/ลบตารางในฐาน user ได้
-- ระบบนี้ใช้ ictservice ต่อทั้งตอนใช้งานจริง (ตัดสินใจ 9 ต.ค. 2569) จึงคงสิทธิ์นี้ไว้
-- ถ้าภายหลังแยกบัญชีตาม spec 11.2 ค่อยถอน:
--   REVOKE CREATE, ALTER, INDEX, REFERENCES, CREATE VIEW, DROP ON `user`.* FROM 'ictservice'@'%';

GRANT CREATE, ALTER, INDEX, REFERENCES, CREATE VIEW, DROP ON `user`.* TO 'ictservice'@'%';
-- DROP จำเป็นสำหรับ prisma migrate ตอนแก้ schema ภายหลัง (เฉพาะตารางของระบบนี้)

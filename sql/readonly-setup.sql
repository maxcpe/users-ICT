-- ตั้งค่าโหมด "อ่านข้อมูลจริง เขียนไม่ได้" สำหรับเครื่องพัฒนา (spec 11.5)
-- รันด้วยบัญชี admin ของ MySQL ครั้งเดียว
-- ผลลัพธ์: แอปอ่าน `user`.`user` จริงได้อย่างเดียว ส่วนข้อมูลของระบบนี้ (รวม user_roles) อยู่ใน usermanagement_dev
-- ไม่สร้างหรือแก้อะไรในฐาน `user` จริง

CREATE DATABASE IF NOT EXISTS `usermanagement_dev` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- บัญชีพัฒนา: ทำได้ทุกอย่างในฐานพัฒนา แต่บนฐานจริงอ่านได้แค่ตาราง user
-- ถ้ารู้ IP เครื่องพัฒนา ให้ใส่แทน '%'
CREATE USER IF NOT EXISTS 'usermanagement_dev'@'%' IDENTIFIED BY '<ตั้งรหัสผ่าน>';
GRANT ALL PRIVILEGES ON `usermanagement_dev`.* TO 'usermanagement_dev'@'%';
GRANT SELECT ON `user`.`user` TO 'usermanagement_dev'@'%';
-- ห้ามให้สิทธิ์อื่นบนฐาน user แอปจะเช็ก SHOW GRANTS ตอนเริ่ม และไม่ยอมทำงานถ้าบัญชีแก้ฐาน user ได้

-- ตาราง user_roles ฉบับฐานพัฒนา (โครงสร้างเดียวกับ spec 2.2)
CREATE TABLE IF NOT EXISTS `usermanagement_dev`.`user_roles` (
  `U_id` int NOT NULL,
  `system_key` varchar(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `level` int NOT NULL,
  PRIMARY KEY (`U_id`, `system_key`),
  KEY `idx_system_level` (`system_key`, `level`)
) ENGINE = InnoDB;

-- ผู้ดูแลกลาง: ผู้พัฒนา
INSERT INTO `usermanagement_dev`.`user_roles` (U_id, system_key, level)
SELECT U_id, 'users', 99 FROM `user`.`user` WHERE LOWER(TRIM(U_email)) = '<อีเมลผู้ดูแลกลาง>'
ON DUPLICATE KEY UPDATE level = 99;

-- จากนั้นในเครื่องพัฒนา:
-- .env:
--   DATABASE_URL=mysql://usermanagement_dev:<รหัสผ่าน>@db.example.local:3306/usermanagement_dev
--   USER_DB=user
--   USER_DB_READONLY=yes
-- แล้วรัน: npm run db:migrate && npm run db:seed && npm run dev

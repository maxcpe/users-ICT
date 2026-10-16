-- ฐานข้อมูลสำหรับพัฒนาเท่านั้น (spec หัวข้อ 11.5)
-- สร้างและเขียนทับเฉพาะฐาน `user_dev` และ `usermanagement_dev`
-- **ห้ามแก้ชื่อฐานในไฟล์นี้เป็น `user` หรือ `usermanagement`** สคริปต์นี้ DROP ตาราง
--
-- โครงสร้างตาราง `user` ตรงกับเซิร์ฟเวอร์จริง (MySQL 8.4.9, ตรวจ 8 ต.ค. 2569)
-- ข้อมูลทั้งหมดเป็นข้อมูลสมมติ ยกเว้นแถวผู้พัฒนาที่ต้องใช้อีเมลจริงเพื่อล็อกอิน 365

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `user_dev` CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci;
CREATE DATABASE IF NOT EXISTS `usermanagement_dev` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `user_dev`;

-- กันพลาด: ถ้าฐานที่เลือกอยู่ไม่ใช่ user_dev ให้หยุดทันที
DROP PROCEDURE IF EXISTS `assert_dev_db`;
DELIMITER //
CREATE PROCEDURE `assert_dev_db`()
BEGIN
  IF DATABASE() <> 'user_dev' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'dev-seed.sql must run on user_dev only';
  END IF;
END //
DELIMITER ;
CALL `assert_dev_db`();
DROP PROCEDURE `assert_dev_db`;

DROP TABLE IF EXISTS `user`;
CREATE TABLE `user`  (
  `U_id` int NOT NULL AUTO_INCREMENT,
  `U_name` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NULL DEFAULT NULL,
  `U_email` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NULL DEFAULT NULL,
  `U_idcard_hmac` char(64) CHARACTER SET ascii COLLATE ascii_bin NULL DEFAULT NULL,
  `U_rfid` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NULL DEFAULT NULL,
  `U_tel` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NULL DEFAULT NULL,
  `U_position` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NULL DEFAULT NULL,
  `U_job` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NULL DEFAULT NULL,
  `U_branch` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NULL DEFAULT NULL,
  `U_van` int NULL DEFAULT NULL,
  `U_projectday` int NULL DEFAULT NULL,
  `U_checkin` int NULL DEFAULT NULL COMMENT '90 user and admin 99 admin only',
  `U_meetingroom` int NULL DEFAULT NULL,
  `U_register` int NULL DEFAULT NULL,
  `U_studyroom` int NULL DEFAULT NULL,
  `U_cultureexercise` int NULL DEFAULT NULL,
  `U_edpex` int NULL DEFAULT NULL,
  `U_evaluation` int NULL DEFAULT NULL,
  PRIMARY KEY (`U_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_unicode_ci ROW_FORMAT = COMPACT;

INSERT INTO `user` (U_id, U_name, U_email, U_idcard_hmac, U_rfid, U_tel, U_position, U_job, U_branch,
  U_van, U_projectday, U_checkin, U_meetingroom, U_register, U_studyroom, U_cultureexercise, U_edpex, U_evaluation) VALUES
-- ผู้พัฒนา: ผู้ดูแลกลาง ใช้ล็อกอินทดสอบ
(1,  'ผู้พัฒนา (บัญชีทดสอบ)', 'dev.admin@example.ac.th', NULL, NULL, '-', 'นักวิชาการคอมพิวเตอร์', 'งานบริหารทั่วไป', 'สำนักงานคณะ', 99, 99, 90, 99, 99, 99, 99, 99, 99),

-- สายสนับสนุน (U_branch = 'สำนักงานคณะ')
(2,  'นางสาวทดสอบ หนึ่ง', 'test.support01@up.ac.th', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0000000001', '1001', 'หัวหน้าสำนักงานคณะ', 'งานบริหารทั่วไป', 'สำนักงานคณะ', 1, NULL, 90, 1, 90, NULL, NULL, NULL, 80),
(3,  'นายทดสอบ สอง', 'test.support02@up.ac.th', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', NULL, '1002', 'หัวหน้างานบริหารทั่วไป', 'งานบริหารทั่วไป', 'สำนักงานคณะ', 99, NULL, 90, 1, 90, NULL, NULL, NULL, 1),
(4,  'นายทดสอบ สาม', 'test.support03@up.ac.th', NULL, NULL, '1003', 'นักวิชาการโสตทัศนศึกษา', 'งานบริหารทั่วไป', 'สำนักงานคณะ', 1, NULL, 1, 99, 90, NULL, NULL, NULL, 1),
(5,  'นางทดสอบ สี่', 'test.support04@up.ac.th', NULL, NULL, '1004', 'เจ้าหน้าที่บริหารงานทั่วไป', 'งานบริหารทั่วไป', 'สำนักงานคณะ', 1, NULL, 1, 1, 90, 99, NULL, NULL, 50),
(6,  'นางสาวทดสอบ ห้า', 'test.support05@up.ac.th', NULL, NULL, '-', 'หัวหน้างานวิชาการ', 'งานวิชาการ', 'สำนักงานคณะ', 1, NULL, 90, 1, 90, NULL, NULL, NULL, 1),
(7,  'นายทดสอบ หก', 'test.support06@up.ac.th', NULL, NULL, '1006', 'นักวิชาการศึกษา', 'งานวิชาการ', 'สำนักงานคณะ', 1, NULL, 1, 1, 90, NULL, NULL, NULL, 1),
(8,  'นายทดสอบ เจ็ด', 'test.support07@up.ac.th', NULL, NULL, '1007', 'หัวหน้างานพัฒนาทักษะดิจิทัล', 'งานพัฒนาทักษะดิจิทัล', 'สำนักงานคณะ', 1, NULL, 90, 1, 90, NULL, 99, NULL, 1),
(9,  'นางทดสอบ แปด', 'test.support08@up.ac.th', NULL, NULL, '1008', 'หัวหน้างานแผนงาน', 'งานแผนงาน', 'สำนักงานคณะ', 1, NULL, 90, 1, 90, NULL, NULL, NULL, 1),

-- สายวิชาการ (U_branch = ชื่อหลักสูตร, U_job = NULL, U_checkin = NULL)
(10, 'ผู้ช่วยศาสตราจารย์ ดร.ทดสอบ เก้า', 'test.academic01@up.ac.th', NULL, NULL, '-', 'คณบดี', NULL, 'วิศวกรรมคอมพิวเตอร์', 1, NULL, 99, 1, 1, NULL, 1, NULL, 1),
(11, 'ดร.ทดสอบ สิบ', 'test.academic02@up.ac.th', NULL, NULL, '-', 'รองคณบดีฝ่ายวิชาการ', NULL, 'ธุรกิจดิจิทัล', 1, 99, NULL, 1, 1, NULL, 1, NULL, 1),
(12, 'นายทดสอบ สิบเอ็ด', 'test.academic03@up.ac.th', NULL, NULL, '-', 'อาจารย์', NULL, 'เทคโนโลยีสารสนเทศ', 1, 1, NULL, 1, 1, NULL, 1, NULL, 1),
(13, 'รองศาสตราจารย์ ดร.ทดสอบ สิบสอง', 'test.academic04@up.ac.th', NULL, NULL, '-', 'รองศาสตราจารย์', NULL, 'ภูมิสารสนเทศศาสตร์', 1, NULL, NULL, 1, 1, NULL, 1, NULL, 1),
(14, 'ดร.ทดสอบ สิบสาม', 'test.academic05@up.ac.th', NULL, NULL, '-', 'อาจารย์', NULL, 'วิทยาการคอมพิวเตอร์', 1, NULL, NULL, 1, 90, NULL, 1, NULL, 1),
(15, 'นางสาวทดสอบ สิบสี่', 'test.academic06@up.ac.th', NULL, NULL, '-', 'ผู้ช่วยสอน', NULL, 'คอมพิวเตอร์กราฟิกและมัลติมีเดีย', 1, 1, NULL, 1, 1, NULL, 1, NULL, NULL),

-- กรณีพิเศษที่ระบบต้องรับมือ
-- อีเมลมีช่องว่างท้าย (spec หัวข้อ 2)
(16, 'ดร.ทดสอบ อีเมลมีช่องว่าง', 'test.trailing@up.ac.th ', NULL, NULL, NULL, 'อาจารย์', NULL, 'วิศวกรรมซอฟต์แวร์', 1, NULL, NULL, 1, 1, NULL, 1, NULL, 1),
-- อีเมลซ้ำกับแถว 12 (ต่างตัวพิมพ์) ต้องมีป้ายเตือน (spec หัวข้อ 4.1)
(17, 'นายทดสอบ อีเมลซ้ำ', 'Test.Academic03@up.ac.th', NULL, NULL, NULL, 'อาจารย์', NULL, 'เทคโนโลยีสารสนเทศ', 1, NULL, NULL, 1, 1, NULL, 1, NULL, NULL),
-- ไม่มีอีเมล
(18, 'นางทดสอบ ไม่มีอีเมล', NULL, NULL, NULL, NULL, 'เจ้าหน้าที่บริหารงานทั่วไป', 'งานบริหารทั่วไป', 'สำนักงานคณะ', NULL, NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL),
-- ไม่มีตำแหน่ง, U_job เป็นค่าว่างแทน NULL
(19, 'ดร.ทดสอบ ไม่มีตำแหน่ง', 'test.noposition@up.ac.th', NULL, NULL, NULL, NULL, '', 'วิทยาการข้อมูลและการประยุกต์', 1, 1, NULL, 1, 1, NULL, 1, NULL, NULL),
-- ค่าสิทธิ์ที่ไม่อยู่ในระดับที่ลงทะเบียน ต้องแสดง "ค่าอื่น (n)" (spec หัวข้อ 4.4)
(20, 'นายทดสอบ ค่าแปลก', 'test.oddvalue@up.ac.th', NULL, NULL, '1020', 'นักวิชาการคอมพิวเตอร์', 'งานบริหารทั่วไป', 'สำนักงานคณะ', 5, NULL, 2, 1, 90, NULL, NULL, NULL, 7),
-- ไม่มีสิทธิ์ในระบบใดเลย (เหมือนคนที่ถูกปิดใช้งาน)
(21, 'นางสาวทดสอบ ไม่มีสิทธิ์', 'test.norole@up.ac.th', NULL, NULL, NULL, 'เจ้าหน้าที่บริหารงานทั่วไป', 'งานแผนงาน', 'สำนักงานคณะ', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
-- นักศึกษา: ต้องไม่แสดงในรายชื่อ และเปิดด้วย URL ต้องได้ 404 (spec หัวข้อ 3.3)
(22, 'นายทดสอบ นักศึกษา', '65000001@up.ac.th', NULL, NULL, NULL, 'นักศึกษา', NULL, 'วิศวกรรมคอมพิวเตอร์', NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL),
-- ผู้ดูแลกลางคนที่สอง ใช้ทดสอบการกันผู้ดูแลกลางคนสุดท้าย (spec หัวข้อ 3.2)
(23, 'นายทดสอบ ผู้ดูแลกลาง', 'test.superadmin@up.ac.th', NULL, NULL, '1023', 'นักวิชาการคอมพิวเตอร์', 'งานบริหารทั่วไป', 'สำนักงานคณะ', 1, NULL, 1, 1, 90, NULL, NULL, NULL, 1);

-- เลข U_id ข้ามได้ เหมือนของจริงที่มีแถวถูกลบไปแล้ว
ALTER TABLE `user` AUTO_INCREMENT = 30;

-- ตารางสิทธิ์กลาง (spec หัวข้อ 2.2)
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
  `U_id` int NOT NULL,
  `system_key` varchar(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `level` int NOT NULL,
  PRIMARY KEY (`U_id`, `system_key`, `level`),
  KEY `idx_system_level` (`system_key`, `level`)
) ENGINE = InnoDB;

INSERT INTO `user_roles` (U_id, system_key, level) VALUES
-- ระบบนี้: ผู้ดูแลกลาง 2 คน (spec หัวข้อ 3.2) และผู้ดูแลระบบ 1 คน
(1,  'users', 99),
(23, 'users', 99),
(5,  'users', 50),
-- ระบบสมมติที่เพิ่มจากหน้าจอ (key `library`): 1 ผู้ใช้ / 99 ผู้ดูแล
(1,  'library', 99),
(7,  'library', 99),
(12, 'library', 1),
(14, 'library', 1),
-- ระดับที่ไม่อยู่ในทะเบียน ต้องแสดง "ค่าอื่น (n)"
(20, 'library', 5);

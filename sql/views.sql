-- view ที่เว็บอื่นใช้อ่านสิทธิ์ (spec 8.1) — ข้อตกลงกับเว็บอื่น ห้ามลบหรือเปลี่ยนความหมายของคอลัมน์
-- รันครั้งเดียวด้วยบัญชีที่มีสิทธิ์ CREATE VIEW (เช่น ict_dbadmin) ต้องมีตาราง user_status และ systems ก่อน (หลัง migrate)
--
-- คีย์ระบบอ่านจากตาราง `user`.`systems` ไม่เขียนตายตัว:
--   - เปลี่ยนคีย์จากหน้าเว็บ → view ใช้คีย์ใหม่ทันที ไม่ต้องรันไฟล์นี้ใหม่
--   - ระบบใหม่ที่เพิ่มจากหน้าจอ (storage = table) อยู่ใน user_roles อยู่แล้ว ไม่ต้องแก้ไฟล์นี้
--   - ระบบแบบ column ที่ย้ายไป user_roles (storage เปลี่ยนเป็น table) ส่วนของคอลัมน์จะหายเอง ไม่มีแถวซ้ำ
-- ต้องแก้ไฟล์นี้เฉพาะเมื่อมีคอลัมน์สิทธิ์ U_… ใหม่ในตาราง user (ไม่ควรเกิด เพราะไม่ ALTER ตาราง user)
--
-- SQL SECURITY DEFINER: เว็บอื่นได้สิทธิ์ SELECT เฉพาะ view ไม่ต้องอ่านตาราง user_status / systems เอง

CREATE OR REPLACE SQL SECURITY DEFINER VIEW `user`.`v_staff` AS
SELECT u.U_id, LOWER(TRIM(u.U_email)) AS U_email, u.U_name, u.U_position, u.U_branch,
       u.U_job  -- ต่อท้ายเท่านั้น (ระบบประเมินใช้กรองหน่วยงาน 16 ต.ค. 2569)
FROM `user`.`user` u
WHERE (u.U_position IS NULL OR u.U_position NOT LIKE 'นักศึกษา%')
  AND NOT EXISTS (SELECT 1 FROM `user`.`user_status` s
                  WHERE s.user_id = u.U_id AND s.status = 'inactive');

CREATE OR REPLACE SQL SECURITY DEFINER VIEW `user`.`v_roles` AS
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, r.system_key, r.level
FROM `user`.`v_staff` v JOIN `user`.`user_roles` r ON r.U_id = v.U_id
UNION ALL
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, s.`key`, u.`U_evaluation`
FROM `user`.`v_staff` v JOIN `user`.`user` u ON u.U_id = v.U_id
JOIN `user`.`systems` s ON s.storage = 'column' AND s.column_name = 'U_evaluation'
WHERE u.`U_evaluation` IS NOT NULL
UNION ALL
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, s.`key`, u.`U_checkin`
FROM `user`.`v_staff` v JOIN `user`.`user` u ON u.U_id = v.U_id
JOIN `user`.`systems` s ON s.storage = 'column' AND s.column_name = 'U_checkin'
WHERE u.`U_checkin` IS NOT NULL
UNION ALL
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, s.`key`, u.`U_van`
FROM `user`.`v_staff` v JOIN `user`.`user` u ON u.U_id = v.U_id
JOIN `user`.`systems` s ON s.storage = 'column' AND s.column_name = 'U_van'
WHERE u.`U_van` IS NOT NULL
UNION ALL
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, s.`key`, u.`U_meetingroom`
FROM `user`.`v_staff` v JOIN `user`.`user` u ON u.U_id = v.U_id
JOIN `user`.`systems` s ON s.storage = 'column' AND s.column_name = 'U_meetingroom'
WHERE u.`U_meetingroom` IS NOT NULL
UNION ALL
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, s.`key`, u.`U_studyroom`
FROM `user`.`v_staff` v JOIN `user`.`user` u ON u.U_id = v.U_id
JOIN `user`.`systems` s ON s.storage = 'column' AND s.column_name = 'U_studyroom'
WHERE u.`U_studyroom` IS NOT NULL
UNION ALL
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, s.`key`, u.`U_register`
FROM `user`.`v_staff` v JOIN `user`.`user` u ON u.U_id = v.U_id
JOIN `user`.`systems` s ON s.storage = 'column' AND s.column_name = 'U_register'
WHERE u.`U_register` IS NOT NULL
UNION ALL
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, s.`key`, u.`U_projectday`
FROM `user`.`v_staff` v JOIN `user`.`user` u ON u.U_id = v.U_id
JOIN `user`.`systems` s ON s.storage = 'column' AND s.column_name = 'U_projectday'
WHERE u.`U_projectday` IS NOT NULL
UNION ALL
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, s.`key`, u.`U_cultureexercise`
FROM `user`.`v_staff` v JOIN `user`.`user` u ON u.U_id = v.U_id
JOIN `user`.`systems` s ON s.storage = 'column' AND s.column_name = 'U_cultureexercise'
WHERE u.`U_cultureexercise` IS NOT NULL
UNION ALL
SELECT v.U_id, v.U_email, v.U_name, v.U_position, v.U_branch, s.`key`, u.`U_edpex`
FROM `user`.`v_staff` v JOIN `user`.`user` u ON u.U_id = v.U_id
JOIN `user`.`systems` s ON s.storage = 'column' AND s.column_name = 'U_edpex'
WHERE u.`U_edpex` IS NOT NULL;

-- ตรวจหลังรัน (ควรได้จำนวนต่อระบบตรงกับหน้า /systems ของเว็บจัดการผู้ใช้ ยกเว้นคนที่ปิดใช้งาน)
-- SELECT system_key, COUNT(*) FROM `user`.`v_roles` GROUP BY system_key ORDER BY system_key;

-- หลายสิทธิ์ต่อคน (spec 2.3, 16 ต.ค. 2569) — รันครั้งเดียวก่อน deploy เวอร์ชันที่รองรับ
-- ictservice มีสิทธิ์ ALTER บนฐาน user อยู่แล้ว (sql/grant-ictservice-create.sql) ไม่แตะตาราง user
-- 1. ตารางสิทธิ์กลาง: 1 แถวต่อ 1 บทบาท (ระบบปกติยังมีได้ไม่เกิน 1 แถว ตรวจในโค้ด)
ALTER TABLE `user`.`user_roles` DROP PRIMARY KEY, ADD PRIMARY KEY (`U_id`, `system_key`, `level`);
-- 2. สวิตช์ต่อระบบ = prisma/migrations/20261016000000_multi_roles (รันแล้ว resolve --applied)

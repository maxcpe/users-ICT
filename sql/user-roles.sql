-- ตารางสิทธิ์กลาง `user`.`user_roles` (spec 2.2) และผู้ดูแลกลางคนแรก (spec 11.2)
-- รันได้ซ้ำ ไม่แก้ตาราง `user` เดิม

CREATE TABLE IF NOT EXISTS `user`.`user_roles` (
  `U_id` int NOT NULL,
  `system_key` varchar(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `level` int NOT NULL,
  PRIMARY KEY (`U_id`, `system_key`),
  KEY `idx_system_level` (`system_key`, `level`)
) ENGINE = InnoDB;

-- ผู้ดูแลกลางคนแรก
INSERT INTO `user`.`user_roles` (U_id, system_key, level)
SELECT U_id, 'users', 99 FROM `user`.`user` WHERE LOWER(TRIM(U_email)) = '<อีเมลผู้ดูแลกลาง>'
ON DUPLICATE KEY UPDATE level = 99;

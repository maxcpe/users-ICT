-- CreateTable
CREATE TABLE `systems` (
    `key` VARCHAR(50) NOT NULL,
    `storage` ENUM('column', 'table') NOT NULL,
    `column_name` VARCHAR(64) NULL,
    `name` VARCHAR(100) NOT NULL,
    `icon` VARCHAR(16) NULL,
    `url` VARCHAR(255) NULL,
    `note` VARCHAR(255) NULL,
    `levels` JSON NOT NULL,
    `unconfirmed` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `systems_column_name_key`(`column_name`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_admins` (
    `system_key` VARCHAR(50) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `assigned_by` INTEGER NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_admins_user_id_idx`(`user_id`),
    PRIMARY KEY (`system_key`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_status` (
    `user_id` INTEGER NOT NULL,
    `status` ENUM('active', 'inactive', 'scheduled') NOT NULL,
    `reason` VARCHAR(100) NOT NULL,
    `effective_date` DATE NOT NULL,
    `saved_roles` JSON NOT NULL,
    `changed_by` INTEGER NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actor_id` INTEGER NOT NULL,
    `target_id` INTEGER NULL,
    `system_key` VARCHAR(50) NULL,
    `action` VARCHAR(40) NOT NULL,
    `changes` JSON NOT NULL,
    `ip` VARCHAR(45) NULL,

    INDEX `audit_log_at_idx`(`at`),
    INDEX `audit_log_target_id_idx`(`target_id`),
    INDEX `audit_log_system_key_at_idx`(`system_key`, `at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_identity` (
    `user_id` INTEGER NOT NULL,
    `oid` VARCHAR(64) NOT NULL,
    `first_login_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_login_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_identity_oid_key`(`oid`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

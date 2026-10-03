USE servex;

-- Add role to existing users.
SET @role_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
);

SET @sql = IF(
    @role_exists = 0,
    'ALTER TABLE users ADD COLUMN role ENUM(''user'',''admin'') NOT NULL DEFAULT ''user'' AFTER password_hash',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add booking_id to service history so a completed booking
-- cannot create duplicate history records.
SET @booking_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'service_history'
      AND COLUMN_NAME = 'booking_id'
);

SET @sql2 = IF(
    @booking_exists = 0,
    'ALTER TABLE service_history ADD COLUMN booking_id INT NULL UNIQUE AFTER service_id',
    'SELECT 1'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Make sure all existing accounts remain normal users.
UPDATE users
SET role = 'user'
WHERE role IS NULL OR role = '';

-- Verify
DESCRIBE users;
DESCRIBE service_history;

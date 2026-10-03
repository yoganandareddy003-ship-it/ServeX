USE servex;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_password_reset_user (user_id),
    KEY idx_password_reset_expiry (expires_at),
    CONSTRAINT fk_reset_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

SET @used_at_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'password_reset_tokens'
      AND COLUMN_NAME = 'used_at'
);

SET @used_at_sql = IF(
    @used_at_exists = 0,
    'ALTER TABLE password_reset_tokens ADD COLUMN used_at DATETIME NULL AFTER expires_at',
    'SELECT 1'
);
PREPARE reset_stmt FROM @used_at_sql;
EXECUTE reset_stmt;
DEALLOCATE PREPARE reset_stmt;

SET @user_index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'password_reset_tokens'
      AND INDEX_NAME = 'idx_password_reset_user'
);

SET @user_index_sql = IF(
    @user_index_exists = 0,
    'CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id)',
    'SELECT 1'
);
PREPARE reset_stmt FROM @user_index_sql;
EXECUTE reset_stmt;
DEALLOCATE PREPARE reset_stmt;

SET @expiry_index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'password_reset_tokens'
      AND INDEX_NAME = 'idx_password_reset_expiry'
);

SET @expiry_index_sql = IF(
    @expiry_index_exists = 0,
    'CREATE INDEX idx_password_reset_expiry ON password_reset_tokens(expires_at)',
    'SELECT 1'
);
PREPARE reset_stmt FROM @expiry_index_sql;
EXECUTE reset_stmt;
DEALLOCATE PREPARE reset_stmt;
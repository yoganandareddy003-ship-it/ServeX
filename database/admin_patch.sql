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

-- Add compatibility to existing service catalogs.
SET @service_vehicle_type_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'services'
      AND COLUMN_NAME = 'vehicle_type'
);

SET @sql3 = IF(
    @service_vehicle_type_exists = 0,
    'ALTER TABLE services ADD COLUMN vehicle_type ENUM(''Electric'',''Petrol'',''Both'') NOT NULL DEFAULT ''Both'' AFTER duration_minutes',
    'SELECT 1'
);

PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

ALTER TABLE services
    MODIFY COLUMN vehicle_type VARCHAR(30) NOT NULL DEFAULT 'Both';

UPDATE services
SET vehicle_type = CASE LOWER(TRIM(vehicle_type))
    WHEN 'electric' THEN 'Electric'
    WHEN 'electric bike' THEN 'Electric'
    WHEN 'petrol' THEN 'Petrol'
    WHEN 'petrol bike' THEN 'Petrol'
    WHEN 'both' THEN 'Both'
    ELSE 'Both'
END;

ALTER TABLE services
    MODIFY COLUMN vehicle_type ENUM('Electric','Petrol','Both') NOT NULL DEFAULT 'Both';

SET @sql4 = IF(
    @service_vehicle_type_exists = 0,
    'UPDATE services SET vehicle_type = ''Petrol'' WHERE service_name IN (''Oil Change'', ''Engine Repair'')',
    'SELECT 1'
);

PREPARE stmt4 FROM @sql4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

CREATE TABLE IF NOT EXISTS parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    part_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(80) NOT NULL,
    vehicle_type ENUM('Electric','Petrol','Both') NOT NULL DEFAULT 'Both',
    price DECIMAL(10,2) NULL DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS booking_parts (
    booking_id INT NOT NULL,
    part_id INT NOT NULL,
    action_type ENUM('Repair','Replace','Inspect') NOT NULL,
    description VARCHAR(500),
    unit_price DECIMAL(10,2) NULL DEFAULT NULL,
    PRIMARY KEY (booking_id, part_id),
    CONSTRAINT fk_booking_parts_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_booking_parts_part
        FOREIGN KEY (part_id) REFERENCES parts(id)
        ON DELETE RESTRICT
);

INSERT IGNORE INTO parts (part_name, category, vehicle_type) VALUES
('Engine Oil', 'Engine and Lubrication', 'Petrol'),
('Oil Filter', 'Engine and Lubrication', 'Petrol'),
('Air Filter', 'Engine and Lubrication', 'Petrol'),
('Spark Plug', 'Engine and Lubrication', 'Petrol'),
('Clutch Plates', 'Engine and Lubrication', 'Petrol'),
('Coolant', 'Engine and Lubrication', 'Petrol'),
('Front Brake Pads or Shoes', 'Braking', 'Both'),
('Rear Brake Pads or Shoes', 'Braking', 'Both'),
('Brake Disc', 'Braking', 'Both'),
('Brake Fluid', 'Braking', 'Both'),
('Brake Cable', 'Braking', 'Both'),
('Drive Chain', 'Transmission', 'Petrol'),
('Front Sprocket', 'Transmission', 'Petrol'),
('Rear Sprocket', 'Transmission', 'Petrol'),
('Clutch Cable', 'Transmission', 'Petrol'),
('Gear Lever', 'Transmission', 'Petrol'),
('Front Tyre', 'Tyres and Wheels', 'Both'),
('Rear Tyre', 'Tyres and Wheels', 'Both'),
('Inner Tube', 'Tyres and Wheels', 'Both'),
('Wheel Bearings', 'Tyres and Wheels', 'Both'),
('Traction Battery', 'Electric Drive', 'Electric'),
('Electric Motor', 'Electric Drive', 'Electric'),
('Motor Controller', 'Electric Drive', 'Electric'),
('Charging Port', 'Electric Drive', 'Electric'),
('12V Battery', 'Electrical', 'Both'),
('Headlight', 'Electrical', 'Both'),
('Tail Light', 'Electrical', 'Both'),
('Indicators', 'Electrical', 'Both'),
('Horn', 'Electrical', 'Both'),
('Fuse and Wiring', 'Electrical', 'Both'),
('Front Fork Seals', 'Suspension and Steering', 'Both'),
('Rear Shock Absorber', 'Suspension and Steering', 'Both'),
('Steering Bearings', 'Suspension and Steering', 'Both'),
('Handlebar', 'Suspension and Steering', 'Both'),
('Mirrors', 'Body and Accessories', 'Both'),
('Seat', 'Body and Accessories', 'Both'),
('Side Stand', 'Body and Accessories', 'Both'),
('Footrest', 'Body and Accessories', 'Both'),
('Mudguard', 'Body and Accessories', 'Both');

-- Make sure all existing accounts remain normal users.
UPDATE users
SET role = 'user'
WHERE role IS NULL OR role = '';

-- Verify
DESCRIBE users;
DESCRIBE service_history;

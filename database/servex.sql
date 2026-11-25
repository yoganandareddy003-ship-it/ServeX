CREATE DATABASE IF NOT EXISTS servex
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE servex;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS service_history;
DROP TABLE IF EXISTS booking_parts;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS parts;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    brand VARCHAR(60) NOT NULL,
    model VARCHAR(80) NOT NULL,
    registration_number VARCHAR(30) NOT NULL UNIQUE,
    year INT,
    fuel_type VARCHAR(30),
    color VARCHAR(40),
    purchase_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_vehicle_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    duration_minutes INT DEFAULT 60,
    vehicle_type ENUM('Electric','Petrol','Both') NOT NULL DEFAULT 'Both',
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    service_id INT NOT NULL,
    service_date DATE NOT NULL,
    service_time TIME NOT NULL,
    notes TEXT,
    status ENUM('Pending','Confirmed','Completed','Cancelled')
        NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_booking_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_booking_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_booking_service
        FOREIGN KEY (service_id) REFERENCES services(id)
        ON DELETE RESTRICT
);

CREATE TABLE parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    part_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(80) NOT NULL,
    vehicle_type ENUM('Electric','Petrol','Both') NOT NULL DEFAULT 'Both',
    price DECIMAL(10,2) NULL DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE booking_parts (
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

INSERT INTO parts (part_name, category, vehicle_type) VALUES
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

CREATE TABLE service_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    service_id INT NOT NULL,
    booking_id INT NULL UNIQUE,
    service_date DATE NOT NULL,
    description VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('Completed','Cancelled')
        NOT NULL DEFAULT 'Completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_history_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_history_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_history_service
        FOREIGN KEY (service_id) REFERENCES services(id)
        ON DELETE RESTRICT
);

INSERT INTO services
(service_name, description, price, duration_minutes, vehicle_type)
VALUES
('General Service', 'Complete basic inspection and maintenance', 799.00, 90, 'Both'),
('Oil Change', 'Engine oil replacement and inspection', 499.00, 45, 'Petrol'),
('Brake Service', 'Brake inspection and adjustment', 599.00, 60, 'Both'),
('Engine Repair', 'Engine inspection and repair', 1499.00, 180, 'Petrol'),
('Tyre Service', 'Tyre inspection, fitting and air check', 399.00, 45, 'Both'),
('Full Service', 'Comprehensive bike maintenance package', 1999.00, 240, 'Both');

-- Demo service history is intentionally not inserted because
-- it belongs to a registered user.

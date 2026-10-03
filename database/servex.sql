CREATE DATABASE IF NOT EXISTS servex
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE servex;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS service_history;
DROP TABLE IF EXISTS bookings;
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
(service_name, description, price, duration_minutes)
VALUES
('General Service', 'Complete basic inspection and maintenance', 799.00, 90),
('Oil Change', 'Engine oil replacement and inspection', 499.00, 45),
('Brake Service', 'Brake inspection and adjustment', 599.00, 60),
('Engine Repair', 'Engine inspection and repair', 1499.00, 180),
('Tyre Service', 'Tyre inspection, fitting and air check', 399.00, 45),
('Full Service', 'Comprehensive bike maintenance package', 1999.00, 240);

-- Demo service history is intentionally not inserted because
-- it belongs to a registered user.

const partsCatalog = [
    ["Engine Oil", "Engine and Lubrication", "Petrol"],
    ["Oil Filter", "Engine and Lubrication", "Petrol"],
    ["Air Filter", "Engine and Lubrication", "Petrol"],
    ["Spark Plug", "Engine and Lubrication", "Petrol"],
    ["Clutch Plates", "Engine and Lubrication", "Petrol"],
    ["Coolant", "Engine and Lubrication", "Petrol"],
    ["Front Brake Pads or Shoes", "Braking", "Both"],
    ["Rear Brake Pads or Shoes", "Braking", "Both"],
    ["Brake Disc", "Braking", "Both"],
    ["Brake Fluid", "Braking", "Both"],
    ["Brake Cable", "Braking", "Both"],
    ["Drive Chain", "Transmission", "Petrol"],
    ["Front Sprocket", "Transmission", "Petrol"],
    ["Rear Sprocket", "Transmission", "Petrol"],
    ["Clutch Cable", "Transmission", "Petrol"],
    ["Gear Lever", "Transmission", "Petrol"],
    ["Front Tyre", "Tyres and Wheels", "Both"],
    ["Rear Tyre", "Tyres and Wheels", "Both"],
    ["Inner Tube", "Tyres and Wheels", "Both"],
    ["Wheel Bearings", "Tyres and Wheels", "Both"],
    ["Traction Battery", "Electric Drive", "Electric"],
    ["Electric Motor", "Electric Drive", "Electric"],
    ["Motor Controller", "Electric Drive", "Electric"],
    ["Charging Port", "Electric Drive", "Electric"],
    ["12V Battery", "Electrical", "Both"],
    ["Headlight", "Electrical", "Both"],
    ["Tail Light", "Electrical", "Both"],
    ["Indicators", "Electrical", "Both"],
    ["Horn", "Electrical", "Both"],
    ["Fuse and Wiring", "Electrical", "Both"],
    ["Front Fork Seals", "Suspension and Steering", "Both"],
    ["Rear Shock Absorber", "Suspension and Steering", "Both"],
    ["Steering Bearings", "Suspension and Steering", "Both"],
    ["Handlebar", "Suspension and Steering", "Both"],
    ["Mirrors", "Body and Accessories", "Both"],
    ["Seat", "Body and Accessories", "Both"],
    ["Side Stand", "Body and Accessories", "Both"],
    ["Footrest", "Body and Accessories", "Both"],
    ["Mudguard", "Body and Accessories", "Both"]
];

async function ensureBikePartsSchema(db) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS parts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            part_name VARCHAR(100) NOT NULL UNIQUE,
            category VARCHAR(80) NOT NULL,
            vehicle_type ENUM('Electric','Petrol','Both') NOT NULL DEFAULT 'Both',
            price DECIMAL(10,2) NULL DEFAULT NULL,
            active BOOLEAN DEFAULT TRUE
        )
    `);

    await db.query(`
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
        )
    `);

    const [partPriceColumn] = await db.query("SHOW COLUMNS FROM parts LIKE 'price'");
    if (!partPriceColumn.length) {
        await db.query("ALTER TABLE parts ADD COLUMN price DECIMAL(10,2) NULL DEFAULT NULL AFTER vehicle_type");
    }

    const [bookingPartPriceColumn] = await db.query("SHOW COLUMNS FROM booking_parts LIKE 'unit_price'");
    if (!bookingPartPriceColumn.length) {
        await db.query("ALTER TABLE booking_parts ADD COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL AFTER description");
    }

    const placeholders = partsCatalog.map(() => "(?, ?, ?)").join(", ");
    await db.query(
        `INSERT IGNORE INTO parts (part_name, category, vehicle_type)
         VALUES ${placeholders}`,
        partsCatalog.flat()
    );
}

module.exports = { ensureBikePartsSchema };
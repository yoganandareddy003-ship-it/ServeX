const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");
const { ensureBikePartsSchema } = require("../utils/parts");

const router = express.Router();
let partsSchemaReady;

router.use(auth);

router.get("/parts", async (req, res) => {
    try {
        if (!partsSchemaReady) {
            partsSchemaReady = ensureBikePartsSchema(db).catch(error => {
                partsSchemaReady = null;
                throw error;
            });
        }
        await partsSchemaReady;

        const [rows] = await db.query(
            `SELECT id, part_name, category, vehicle_type, price
             FROM parts
             WHERE active = TRUE
             ORDER BY category, part_name`
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        const message = error.code === "ER_NO_SUCH_TABLE"
            ? "Bike parts tables are missing. Run database/admin_patch.sql against the database configured by the backend."
            : `Unable to load bike parts (${error.code || "database error"})`;
        res.status(500).json({ message });
    }
});

router.get("/", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT b.id, b.service_date, b.service_time, b.notes,
                    b.status, b.created_at,
                    v.id AS vehicle_id,
                    v.brand, v.model, v.registration_number,
                    s.service_name, s.price
             FROM bookings b
             INNER JOIN vehicles v ON v.id = b.vehicle_id
             INNER JOIN services s ON s.id = b.service_id
             WHERE b.user_id = ?
             ORDER BY b.service_date DESC, b.service_time DESC`,
            [req.user.id]
        );

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load bookings" });
    }
});

router.post("/", async (req, res) => {
    const connection = await db.getConnection();
    let transactionStarted = false;

    try {
        const {
            vehicle_id,
            service_id,
            service_date,
            service_time,
            notes,
            part_ids,
            part_action,
            part_description
        } = req.body;

        const allowedTimes = [
            "09:00:00",
            "10:00:00",
            "11:00:00",
            "12:00:00",
            "14:00:00",
            "15:00:00",
            "16:00:00",
            "17:00:00"
        ];

        if (!vehicle_id || !service_id || !service_date || !service_time) {
            return res.status(400).json({
                message: "Bike, service, date and time are required"
            });
        }

        if (!allowedTimes.includes(service_time)) {
            return res.status(400).json({
                message: "Please select a booking time within business hours (9:00 AM to 5:00 PM)."
            });
        }

        if (!Array.isArray(part_ids) || part_ids.length === 0 || part_ids.length > 50) {
            return res.status(400).json({
                message: "Select between 1 and 50 bike parts"
            });
        }

        const partIds = part_ids.map(Number);
        if (partIds.some(id => !Number.isInteger(id) || id < 1) ||
            new Set(partIds).size !== partIds.length) {
            return res.status(400).json({
                message: "Selected bike parts are invalid"
            });
        }

        if (!["Repair", "Replace", "Inspect"].includes(part_action)) {
            return res.status(400).json({
                message: "Choose whether the selected parts need repair, replacement or inspection"
            });
        }

        if (part_description != null &&
            (typeof part_description !== "string" || part_description.length > 500)) {
            return res.status(400).json({
                message: "The parts description must be 500 characters or fewer"
            });
        }

        const [vehicleRows] = await connection.query(
            "SELECT id, fuel_type FROM vehicles WHERE id = ? AND user_id = ?",
            [vehicle_id, req.user.id]
        );

        if (!vehicleRows.length) {
            return res.status(403).json({
                message: "Selected vehicle does not belong to this account"
            });
        }

        const [serviceRows] = await connection.query(
            "SELECT id, vehicle_type FROM services WHERE id = ? AND active = TRUE",
            [service_id]
        );

        if (!serviceRows.length) {
            return res.status(404).json({ message: "Selected service is unavailable" });
        }

        const vehicleType = String(vehicleRows[0].fuel_type || "").toLowerCase();
        const serviceType = String(serviceRows[0].vehicle_type || "Both").toLowerCase();
        if (serviceType !== "both" && serviceType !== vehicleType) {
            return res.status(400).json({
                message: "Selected service is not available for this bike type"
            });
        }

        const compatibleVehicleType = vehicleType.includes("electric")
            ? "Electric"
            : vehicleType.includes("petrol")
                ? "Petrol"
                : null;
        const partPlaceholders = partIds.map(() => "?").join(", ");
        const partCompatibility = compatibleVehicleType
            ? "AND (vehicle_type = ? OR vehicle_type = 'Both')"
            : "AND vehicle_type = 'Both'";
        const partParameters = compatibleVehicleType
            ? [...partIds, compatibleVehicleType]
            : partIds;
        const [partRows] = await connection.query(
            `SELECT id, price FROM parts
             WHERE active = TRUE
               AND id IN (${partPlaceholders})
               ${partCompatibility}`,
            partParameters
        );

        if (partRows.length !== partIds.length) {
            return res.status(400).json({
                message: "One or more selected parts are unavailable for this bike"
            });
        }

        await connection.beginTransaction();
        transactionStarted = true;
        const [result] = await connection.query(
            `INSERT INTO bookings
             (user_id, vehicle_id, service_id, service_date, service_time, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
            [
                req.user.id,
                vehicle_id,
                service_id,
                service_date,
                service_time,
                notes || null
            ]
        );

        await connection.query(
            `INSERT INTO booking_parts
             (booking_id, part_id, action_type, description, unit_price)
             VALUES ${partIds.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
            partRows.flatMap(part => [
                result.insertId,
                part.id,
                part_action,
                part_description?.trim() || null,
                part.price
            ])
        );
        await connection.commit();
        transactionStarted = false;

        res.status(201).json({
            message: "Service booking confirmed",
            id: result.insertId
        });
    } catch (error) {
        if (transactionStarted) {
            await connection.rollback();
        }
        console.error(error);
        res.status(500).json({
            message: "Unable to create booking"
        });
    } finally {
        connection.release();
    }
});

router.put("/:id/cancel", async (req, res) => {
    try {
        const [result] = await db.query(
            `UPDATE bookings
             SET status = 'Cancelled'
             WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        res.json({ message: "Booking cancelled" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to cancel booking" });
    }
});

module.exports = router;

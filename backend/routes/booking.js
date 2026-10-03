const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

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

    try {
        const {
            vehicle_id,
            service_id,
            service_date,
            service_time,
            notes
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

        const [vehicleRows] = await connection.query(
            "SELECT id FROM vehicles WHERE id = ? AND user_id = ?",
            [vehicle_id, req.user.id]
        );

        if (!vehicleRows.length) {
            return res.status(403).json({
                message: "Selected vehicle does not belong to this account"
            });
        }

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

        res.status(201).json({
            message: "Service booking confirmed",
            id: result.insertId
        });
    } catch (error) {
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

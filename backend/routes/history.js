const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

router.get("/", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
                h.id,
                h.service_date,
                h.description,
                h.amount,
                h.status,
                h.created_at,
                v.id AS vehicle_id,
                v.brand,
                v.model,
                v.registration_number,
                s.id AS service_id,
                s.service_name
             FROM service_history h
             INNER JOIN vehicles v ON v.id = h.vehicle_id
             INNER JOIN services s ON s.id = h.service_id
                         WHERE h.user_id = ?
                             AND h.status = 'Completed'
                             AND h.service_date <= CURRENT_DATE()
             ORDER BY h.service_date DESC, h.id DESC`,
            [req.user.id]
        );

        res.json(rows);
    } catch (error) {
        console.error("SERVICE HISTORY ERROR:", error);
        res.status(500).json({
            message: "Unable to load service history"
        });
    }
});

router.get("/vehicle/:vehicleId", async (req, res) => {
    try {

        const vehicleId = req.params.vehicleId;
        const userId = req.user.id;

        const [vehicleRows] = await db.query(
            `SELECT id, brand, model, registration_number
             FROM vehicles
             WHERE id = ? AND user_id = ?`,
            [vehicleId, userId]
        );

        if (!vehicleRows.length) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                h.id,
                h.service_date,
                h.description,
                h.amount,
                h.status,
                h.created_at,

                v.id AS vehicle_id,
                v.brand,
                v.model,
                v.registration_number,

                s.id AS service_id,
                s.service_name

            FROM service_history h

            INNER JOIN vehicles v
                ON v.id = h.vehicle_id

            INNER JOIN services s
                ON s.id = h.service_id

            WHERE h.vehicle_id = ?
              AND h.user_id = ?

            ORDER BY h.service_date DESC, h.id DESC
            `,
            [vehicleId, userId]
        );

        const totalServices = rows.filter(
            row => row.status === "Completed"
        ).length;

        const totalAmount = rows
            .filter(row => row.status === "Completed")
            .reduce(
                (total, row) => total + Number(row.amount),
                0
            );

        res.json({
            vehicle: vehicleRows[0],

            summary: {
                totalServices,
                totalAmount
            },

            history: rows
        });

    } catch (error) {

        console.error(
            "VEHICLE SERVICE HISTORY ERROR:",
            error
        );

        res.status(500).json({
            message: "Unable to load vehicle service history",
            error: error.message
        });
    }
});

module.exports = router;
const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

router.get("/", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, brand, model, registration_number, year,
                    fuel_type, color, purchase_date, created_at
             FROM vehicles
             WHERE user_id = ?
             ORDER BY id DESC`,
            [req.user.id]
        );

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load vehicles" });
    }
});

router.post("/", async (req, res) => {
    try {
        const {
            brand,
            model,
            registration_number,
            year,
            fuel_type,
            color,
            purchase_date
        } = req.body;

        if (!brand || !model || !registration_number) {
            return res.status(400).json({
                message: "Brand, model and registration number are required"
            });
        }

        const [existing] = await db.query(
            `SELECT id FROM vehicles
             WHERE registration_number = ?`,
            [registration_number.trim().toUpperCase()]
        );

        if (existing.length) {
            return res.status(409).json({
                message: "This registration number is already registered"
            });
        }

        const [result] = await db.query(
            `INSERT INTO vehicles
             (user_id, brand, model, registration_number, year,
              fuel_type, color, purchase_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                brand.trim(),
                model.trim(),
                registration_number.trim().toUpperCase(),
                year || null,
                fuel_type || null,
                color || null,
                purchase_date || null
            ]
        );

        res.status(201).json({
            message: "Vehicle added successfully",
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to add vehicle" });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const {
            brand,
            model,
            registration_number,
            year,
            fuel_type,
            color,
            purchase_date
        } = req.body;

        const [result] = await db.query(
            `UPDATE vehicles
             SET brand = ?, model = ?, registration_number = ?,
                 year = ?, fuel_type = ?, color = ?, purchase_date = ?
             WHERE id = ? AND user_id = ?`,
            [
                brand,
                model,
                registration_number
                    ? registration_number.trim().toUpperCase()
                    : null,
                year || null,
                fuel_type || null,
                color || null,
                purchase_date || null,
                req.params.id,
                req.user.id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }

        res.json({ message: "Vehicle updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to update vehicle" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM vehicles WHERE id = ? AND user_id = ?",
            [req.params.id, req.user.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }

        res.json({ message: "Vehicle deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Vehicle cannot be deleted because it may have service records"
        });
    }
});

module.exports = router;

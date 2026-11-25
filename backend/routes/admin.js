const express = require("express");
const db = require("../db");
const adminOnly = require("../middleware/admin");
const { ensureBikePartsSchema } = require("../utils/parts");

const router = express.Router();

router.use(adminOnly);

// Dashboard statistics
router.get("/stats", async (req, res) => {
    try {
        const [[users]] = await db.query("SELECT COUNT(*) total FROM users WHERE role='user'");
        const [[vehicles]] = await db.query("SELECT COUNT(*) total FROM vehicles");
        const [[bookings]] = await db.query("SELECT COUNT(*) total FROM bookings");
        const [[pending]] = await db.query("SELECT COUNT(*) total FROM bookings WHERE status='Pending'");
        const [[completed]] = await db.query("SELECT COUNT(*) total FROM bookings WHERE status='Completed'");
        const [[revenue]] = await db.query(
            "SELECT COALESCE(SUM(amount),0) total FROM service_history WHERE status='Completed'"
        );

        res.json({
            users: Number(users.total),
            vehicles: Number(vehicles.total),
            bookings: Number(bookings.total),
            pending: Number(pending.total),
            completed: Number(completed.total),
            revenue: Number(revenue.total)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load admin statistics" });
    }
});

// Users
router.get("/users", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.created_at,
                    COUNT(DISTINCT v.id) vehicle_count
             FROM users u
             LEFT JOIN vehicles v ON v.user_id = u.id
             GROUP BY u.id
             ORDER BY u.created_at DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load users" });
    }
});

// Update user role
router.put("/users/:id/role", async (req, res) => {
    try {
        const { role } = req.body;

        if (!["user", "admin"].includes(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }

        if (Number(req.params.id) === Number(req.user.id) && role !== "admin") {
            return res.status(400).json({
                message: "You cannot remove your own admin role"
            });
        }

        const [result] = await db.query(
            "UPDATE users SET role=? WHERE id=?",
            [role, req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "User role updated" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to update role" });
    }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
    try {
        if (Number(req.params.id) === Number(req.user.id)) {
            return res.status(400).json({
                message: "You cannot delete your own admin account"
            });
        }

        const [result] = await db.query(
            "DELETE FROM users WHERE id=?",
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "User deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "User cannot be deleted"
        });
    }
});

// All vehicles
router.get("/vehicles", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT v.*, u.full_name, u.email
             FROM vehicles v
             INNER JOIN users u ON u.id=v.user_id
             ORDER BY v.id DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load vehicles" });
    }
});

// All bookings
router.get("/bookings", async (req, res) => {
    try {
        await ensureBikePartsSchema(db);
        const [rows] = await db.query(
            `SELECT b.*, u.full_name, u.email,
                    v.brand, v.model, v.registration_number,
                                        s.service_name, s.price,
                                        (SELECT GROUP_CONCAT(
                                            CONCAT(p.part_name, ' (', bp.action_type, ') — ',
                                                IF(bp.unit_price IS NULL,
                                                    'Price pending',
                                                    CONCAT('₹', FORMAT(bp.unit_price, 2)))
                                            )
                                            ORDER BY p.category, p.part_name SEPARATOR ', '
                                        )
                                         FROM booking_parts bp
                                         INNER JOIN parts p ON p.id = bp.part_id
                                         WHERE bp.booking_id = b.id) AS requested_parts,
                                        (SELECT SUM(bp.unit_price)
                                         FROM booking_parts bp
                                         WHERE bp.booking_id = b.id) AS parts_price_total,
                                        (SELECT COUNT(*)
                                         FROM booking_parts bp
                                         WHERE bp.booking_id = b.id) AS requested_parts_count,
                                        (SELECT COUNT(bp.unit_price)
                                         FROM booking_parts bp
                                         WHERE bp.booking_id = b.id) AS priced_parts_count,
                                        (SELECT MAX(bp.description)
                                         FROM booking_parts bp
                                         WHERE bp.booking_id = b.id) AS parts_description,
                                        h.id AS invoice_id, h.amount AS invoice_amount,
                                        h.description AS invoice_description
             FROM bookings b
             INNER JOIN users u ON u.id=b.user_id
             INNER JOIN vehicles v ON v.id=b.vehicle_id
             INNER JOIN services s ON s.id=b.service_id
                         LEFT JOIN service_history h ON h.id = (
                                 SELECT sh.id
                                 FROM service_history sh
                                 WHERE sh.status = 'Completed'
                                     AND (
                                             sh.booking_id = b.id
                                             OR (sh.booking_id IS NULL
                                                     AND sh.user_id = b.user_id
                                                     AND sh.vehicle_id = b.vehicle_id
                                                     AND sh.service_id = b.service_id
                                                     AND sh.service_date = b.service_date)
                                     )
                                 ORDER BY (sh.booking_id = b.id) DESC, sh.id DESC
                                 LIMIT 1
                         )
             ORDER BY b.service_date DESC, b.service_time DESC, b.id DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load bookings" });
    }
});

router.get("/history", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT h.id,
                    h.service_date,
                    h.description,
                    h.amount,
                    h.status,
                    u.full_name,
                    u.email,
                    v.brand,
                    v.model,
                    v.registration_number,
                    s.service_name
             FROM service_history h
             INNER JOIN users u ON u.id = h.user_id
             INNER JOIN vehicles v ON v.id = h.vehicle_id
             INNER JOIN services s ON s.id = h.service_id
             ORDER BY h.service_date DESC, h.id DESC`
        );

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load service history" });
    }
});

// Update booking status.
// Completing a booking automatically creates a service_history row.
router.put("/bookings/:id/status", async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { status } = req.body;
        const allowed = ["Pending", "Confirmed", "Completed", "Cancelled"];

        if (!allowed.includes(status)) {
            return res.status(400).json({ message: "Invalid booking status" });
        }

        await connection.beginTransaction();

        const [rows] = await connection.query(
            `SELECT b.*, s.service_name, s.price
             FROM bookings b
             INNER JOIN services s ON s.id=b.service_id
             WHERE b.id=?`,
            [req.params.id]
        );

        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Booking not found" });
        }

        const booking = rows[0];

        await connection.query(
            "UPDATE bookings SET status=? WHERE id=?",
            [status, req.params.id]
        );

        if (status === "Completed") {
            const [history] = await connection.query(
                "SELECT id FROM service_history WHERE booking_id=? LIMIT 1",
                [booking.id]
            );

            if (!history.length) {
                await connection.query(
                    `INSERT INTO service_history
                     (user_id, vehicle_id, service_id, booking_id,
                      service_date, description, amount, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed')`,
                    [
                        booking.user_id,
                        booking.vehicle_id,
                        booking.service_id,
                        booking.id,
                        booking.service_date,
                        booking.notes || `${booking.service_name} completed`,
                        booking.price
                    ]
                );
            }
        }

        await connection.commit();

        res.json({
            message: `Booking marked ${status}`
        });
    } catch (error) {
        await connection.rollback();
        console.error(error);

        if (error.code === "ER_BAD_FIELD_ERROR" && error.message.includes("booking_id")) {
            return res.status(500).json({
                message: "Database update required: run database/admin_patch.sql, then retry."
            });
        }

        res.status(500).json({ message: "Unable to update booking" });
    } finally {
        connection.release();
    }
});

// Services CRUD
function isValidServiceVehicleType(vehicleType) {
    return ["Electric", "Petrol", "Both"].includes(vehicleType);
}

router.get("/parts", async (req, res) => {
    try {
        await ensureBikePartsSchema(db);
        const [rows] = await db.query(
            `SELECT id, part_name, category, vehicle_type, price
             FROM parts
             WHERE active = TRUE
             ORDER BY category, part_name`
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load bike parts" });
    }
});

router.patch("/parts/:id/price", async (req, res) => {
    const rawPrice = req.body.price;
    const price = rawPrice === "" || rawPrice == null ? null : Number(rawPrice);

    if (price !== null && (!Number.isFinite(price) || price < 0)) {
        return res.status(400).json({ message: "Part price must be zero or greater" });
    }

    try {
        await ensureBikePartsSchema(db);
        const [result] = await db.query(
            "UPDATE parts SET price = ? WHERE id = ? AND active = TRUE",
            [price, req.params.id]
        );

        if (!result.affectedRows) {
            const [[part]] = await db.query(
                "SELECT id, price FROM parts WHERE id = ? AND active = TRUE",
                [req.params.id]
            );
            if (!part) return res.status(404).json({ message: "Bike part not found" });
            return res.json({ price: part.price });
        }

        res.json({ price });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to update bike part price" });
    }
});

router.get("/services", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM services ORDER BY id"
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load services" });
    }
});

router.post("/services", async (req, res) => {
    try {
        const {
            service_name,
            description,
            price,
            duration_minutes,
            vehicle_type = "Both"
        } = req.body;

        if (!service_name) {
            return res.status(400).json({
                message: "Service name is required"
            });
        }

        if (!isValidServiceVehicleType(vehicle_type)) {
            return res.status(400).json({
                message: "Compatible bike type must be Electric, Petrol or Both"
            });
        }

        const [result] = await db.query(
            `INSERT INTO services
             (service_name, description, price, duration_minutes, vehicle_type)
             VALUES (?, ?, ?, ?, ?)`,
            [
                service_name.trim(),
                description || null,
                Number(price || 0),
                Number(duration_minutes || 60),
                vehicle_type
            ]
        );

        res.status(201).json({
            message: "Service added",
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to add service" });
    }
});

router.put("/services/:id", async (req, res) => {
    try {
        const {
            service_name,
            description,
            price,
            duration_minutes,
            vehicle_type = "Both",
            active
        } = req.body;

        if (!isValidServiceVehicleType(vehicle_type)) {
            return res.status(400).json({
                message: "Compatible bike type must be Electric, Petrol or Both"
            });
        }

        const [result] = await db.query(
            `UPDATE services
             SET service_name=?, description=?, price=?,
                 duration_minutes=?, vehicle_type=?, active=?
             WHERE id=?`,
            [
                service_name,
                description || null,
                Number(price || 0),
                Number(duration_minutes || 60),
                vehicle_type,
                active ? 1 : 0,
                req.params.id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: "Service not found" });
        }

        res.json({ message: "Service updated" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to update service" });
    }
});

router.patch("/services/:id/vehicle-type", async (req, res) => {
    const { vehicle_type: vehicleType } = req.body;

    if (!isValidServiceVehicleType(vehicleType)) {
        return res.status(400).json({
            message: "Compatible bike type must be Electric, Petrol or Both"
        });
    }

    try {
        await db.query(
            "UPDATE services SET vehicle_type = ? WHERE id = ?",
            [vehicleType, req.params.id]
        );

        const [[service]] = await db.query(
            "SELECT vehicle_type FROM services WHERE id = ?",
            [req.params.id]
        );

        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }

        res.json({ vehicle_type: service.vehicle_type });
    } catch (error) {
        console.error("Unable to update compatible bike type:", error);

        const message = [
            "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD",
            "WARN_DATA_TRUNCATED"
        ].includes(error.code)
            ? "The services table has an outdated bike-type definition. Run database/admin_patch.sql and restart the backend."
            : error.code === "ER_BAD_FIELD_ERROR"
                ? "The connected database is missing services.vehicle_type. Apply database/admin_patch.sql to the database configured by the backend."
            : [
                "ER_ACCESS_DENIED_ERROR",
                "ER_DBACCESS_DENIED_ERROR",
                "ER_TABLEACCESS_DENIED_ERROR",
                "ER_COLUMNACCESS_DENIED_ERROR"
            ].includes(error.code)
                ? "The database account does not have permission to update services."
                : `Unable to update compatible bike type (${error.code || "unknown database error"})`;

        res.status(500).json({ message });
    }
});

router.delete("/services/:id", async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM services WHERE id=?",
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: "Service not found" });
        }

        res.json({ message: "Service deleted" });
    } catch (error) {
        console.error(error);
        res.status(400).json({
            message: "Service cannot be deleted because it is used by existing records"
        });
    }
});

module.exports = router;

const express = require("express");
const db = require("../db");
const adminOnly = require("../middleware/admin");

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
        const [rows] = await db.query(
            `SELECT b.*, u.full_name, u.email,
                    v.brand, v.model, v.registration_number,
                    s.service_name, s.price
             FROM bookings b
             INNER JOIN users u ON u.id=b.user_id
             INNER JOIN vehicles v ON v.id=b.vehicle_id
             INNER JOIN services s ON s.id=b.service_id
             ORDER BY b.service_date DESC, b.service_time DESC, b.id DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load bookings" });
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
            duration_minutes
        } = req.body;

        if (!service_name) {
            return res.status(400).json({
                message: "Service name is required"
            });
        }

        const [result] = await db.query(
            `INSERT INTO services
             (service_name, description, price, duration_minutes)
             VALUES (?, ?, ?, ?)`,
            [
                service_name.trim(),
                description || null,
                Number(price || 0),
                Number(duration_minutes || 60)
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
            active
        } = req.body;

        const [result] = await db.query(
            `UPDATE services
             SET service_name=?, description=?, price=?,
                 duration_minutes=?, active=?
             WHERE id=?`,
            [
                service_name,
                description || null,
                Number(price || 0),
                Number(duration_minutes || 60),
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

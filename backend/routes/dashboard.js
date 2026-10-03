const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

router.get("/stats", async (req, res) => {
    try {
        const [vehicleRows] = await db.query(
            "SELECT COUNT(*) AS total FROM vehicles WHERE user_id = ?",
            [req.user.id]
        );

        const [bookingRows] = await db.query(
            `SELECT COUNT(*) AS total
             FROM bookings
             WHERE user_id = ? AND status IN ('Pending','Confirmed')`,
            [req.user.id]
        );

        const [completedRows] = await db.query(
            `SELECT COUNT(*) AS total
             FROM service_history
             WHERE user_id = ? AND status = 'Completed'`,
            [req.user.id]
        );

        const [spentRows] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM service_history
             WHERE user_id = ?`,
            [req.user.id]
        );

        const [vehicleTrendRows, bookingTrendRows, serviceTrendRows] = await Promise.all([
            db.query(
                `SELECT
                    SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS recent,
                    SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
                              AND created_at < DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS previous
                 FROM vehicles
                 WHERE user_id = ?
                   AND created_at >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)`,
                [req.user.id]
            ),
            db.query(
                `SELECT
                    SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS recent,
                    SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
                              AND created_at < DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS previous
                 FROM bookings
                 WHERE user_id = ?
                   AND status IN ('Pending', 'Confirmed')
                   AND created_at >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)`,
                [req.user.id]
            ),
            db.query(
                `SELECT
                    SUM(CASE WHEN service_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                              AND status = 'Completed' THEN 1 ELSE 0 END) AS recent_services,
                    SUM(CASE WHEN service_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
                              AND service_date < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                              AND status = 'Completed' THEN 1 ELSE 0 END) AS previous_services,
                    COALESCE(SUM(CASE WHEN service_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                                      THEN amount ELSE 0 END), 0) AS recent_spend,
                    COALESCE(SUM(CASE WHEN service_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
                                      AND service_date < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                                      THEN amount ELSE 0 END), 0) AS previous_spend
                 FROM service_history
                 WHERE user_id = ?
                   AND service_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)`,
                [req.user.id]
            )
        ]);

        const [recentRows] = await db.query(
            `SELECT b.id, b.service_date, b.service_time, b.status,
                    v.brand, v.model, v.registration_number,
                s.service_name,
                h.id AS invoice_id, h.amount AS invoice_amount
             FROM bookings b
             INNER JOIN vehicles v ON v.id = b.vehicle_id
             INNER JOIN services s ON s.id = b.service_id
                 LEFT JOIN service_history h ON h.id = (
                     SELECT sh.id
                     FROM service_history sh
                     WHERE sh.user_id = b.user_id
                        AND sh.vehicle_id = b.vehicle_id
                        AND sh.service_id = b.service_id
                        AND sh.service_date = b.service_date
                        AND sh.status = 'Completed'
                     ORDER BY sh.id DESC
                     LIMIT 1
                 )
             WHERE b.user_id = ?
             ORDER BY b.created_at DESC
             LIMIT 5`,
            [req.user.id]
        );

        const [reminderRows] = await db.query(
            `SELECT b.id, b.service_date, b.service_time, b.status,
                    v.brand, v.model, v.registration_number,
                    s.service_name
             FROM bookings b
             INNER JOIN vehicles v ON v.id = b.vehicle_id
             INNER JOIN services s ON s.id = b.service_id
             WHERE b.user_id = ?
               AND b.status IN ('Pending', 'Confirmed')
             ORDER BY b.service_date ASC, b.service_time ASC
             LIMIT 2`,
            [req.user.id]
        );

        reminderRows.sort((a, b) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const dateA = new Date(a.service_date + "T12:00:00");
            const dateB = new Date(b.service_date + "T12:00:00");
            const diffA = dateA.getTime() - today.getTime();
            const diffB = dateB.getTime() - today.getTime();

            if (diffA < 0 && diffB >= 0) return -1;
            if (diffB < 0 && diffA >= 0) return 1;
            return diffA - diffB;
        });

        res.json({
            totalVehicles: vehicleRows[0].total,
            activeBookings: bookingRows[0].total,
            completedServices: completedRows[0].total,
            totalSpent: Number(spentRows[0].total),
            trends: {
                vehiclesAdded: {
                    recent: Number(vehicleTrendRows[0][0].recent || 0),
                    previous: Number(vehicleTrendRows[0][0].previous || 0)
                },
                activeBookings: {
                    recent: Number(bookingTrendRows[0][0].recent || 0),
                    previous: Number(bookingTrendRows[0][0].previous || 0)
                },
                completedServices: {
                    recent: Number(serviceTrendRows[0][0].recent_services || 0),
                    previous: Number(serviceTrendRows[0][0].previous_services || 0)
                },
                totalSpent: {
                    recent: Number(serviceTrendRows[0][0].recent_spend || 0),
                    previous: Number(serviceTrendRows[0][0].previous_spend || 0)
                }
            },
            recentBookings: recentRows,
            upcomingReminders: reminderRows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Unable to load dashboard statistics"
        });
    }
});

module.exports = router;

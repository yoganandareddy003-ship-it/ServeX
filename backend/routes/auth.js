const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");
const db = require("../db");
const auth = require("../middleware/auth");
const { jwtSecret } = require("../config");
const { isEmailConfigured, sendPasswordResetEmail } = require("../utils/email");

const router = express.Router();
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Try again later." }
});
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many registration attempts. Try again later." }
});
const resetRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many reset requests. Try again later." }
});
const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Try again later." }
});

function makeToken(user) {
    return jwt.sign(
        {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.role || "user"
        },
        jwtSecret,
        { expiresIn: "7d" }
    );
}

    router.post("/register", registrationLimiter, async (req, res) => {
    try {
        const { full_name, email, phone, password } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: "Full name, email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters"
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const [existing] = await db.query(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [cleanEmail]
        );

        if (existing.length) {
            return res.status(409).json({
                message: "An account with this email already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            `INSERT INTO users (full_name, email, phone, password_hash, role)
             VALUES (?, ?, ?, ?, 'user')`,
            [
                full_name.trim(),
                cleanEmail,
                phone ? phone.trim() : null,
                passwordHash
            ]
        );

        const user = {
            id: result.insertId,
            full_name: full_name.trim(),
            email: cleanEmail,
            role: "user"
        };

        res.status(201).json({
            message: "Registration successful",
            token: makeToken(user),
            user
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ message: "Registration failed" });
    }
});

router.post("/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const [rows] = await db.query(
            "SELECT * FROM users WHERE email = ? LIMIT 1",
            [email.trim().toLowerCase()]
        );

        if (!rows.length) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = rows[0];

        const valid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!valid) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const publicUser = {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            role: user.role
        };

        res.json({
            message: "Login successful",
            token: makeToken(user),
            user: publicUser
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Login failed" });
    }
});

router.post("/forgot-password", resetRequestLimiter, async (req, res) => {
    console.log("========== FORGOT PASSWORD ROUTE HIT ==========");
    const genericMessage = "If an account exists for this email, a reset link has been sent.";
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    console.log("PASSWORD RESET: Email received:", JSON.stringify(email));
    if (!email) {
        return res.status(400).json({ message: "Email address is required" });
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address" });
    }

    const smtpConfigured = isEmailConfigured();

    console.log("SMTP configured:", smtpConfigured);
    console.log("SMTP host:", process.env.SMTP_HOST);
    console.log("SMTP user configured:", Boolean(process.env.SMTP_USER));
    console.log("SMTP password configured:", Boolean(process.env.SMTP_PASS));

    if (!isEmailConfigured()) {
        return res.status(503).json({
            message: "Password reset is temporarily unavailable. Please try again later."
        });
    }

    const port = process.env.PORT || 5000;
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_BASE_URL ||
        `http://localhost:${port}/`;
    let resetUrl;

    try {
        resetUrl = new URL("reset-password.html", `${frontendUrl.replace(/\/+$/, "")}/`);
        if (!["http:", "https:"].includes(resetUrl.protocol) ||
            (process.env.NODE_ENV === "production" && resetUrl.protocol !== "https:")) {
            throw new Error("Invalid password reset URL protocol");
        }
    } catch (error) {
        console.error("Password reset URL configuration error:", error);
        return res.status(503).json({
            message: "Password reset is temporarily unavailable. Please try again later."
        });
    }

    try {
        
        const [dbInfo] = await db.query("SELECT DATABASE() AS db");
        console.log("PASSWORD RESET: Backend database:", dbInfo[0].db);
        console.log("PASSWORD RESET: Searching for:", JSON.stringify(email));

        const [users] = await db.query(
            
            "SELECT id, email, full_name FROM users WHERE email = ? AND role ='user' LIMIT 1",
            [email]
        );

        console.log("PASSWORD RESET: Users found:", users.length);

        if (!users.length) {
            return res.json({ message: genericMessage });
        }

        const user = users[0];
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        await db.query(
            "DELETE FROM password_reset_tokens WHERE expires_at <= UTC_TIMESTAMP() OR used_at IS NOT NULL"
        );
        await db.query(
            "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
            [user.id]
        );
        await db.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))`,
            [user.id, tokenHash]
        );

        resetUrl.searchParams.set("token", token);

        try {
            console.log("PASSWORD RESET: Starting email send...");
console.log("PASSWORD RESET: Recipient:", user.email);

await sendPasswordResetEmail({
    email: user.email,
    fullName: user.full_name,
    resetUrl: resetUrl.toString()
});

console.log("PASSWORD RESET: Email send completed.");
        } catch (mailError) {
            console.error("Password reset email error:", mailError);
            try {
                await db.query(
                    "DELETE FROM password_reset_tokens WHERE token_hash = ?",
                    [tokenHash]
                );
            } catch (cleanupError) {
                console.error("Password reset token cleanup error:", cleanupError);
            }
        }

        res.json({ message: genericMessage });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ message: "Unable to process the request right now" });
    }
});

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
    const { token, password } = req.body || {};

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(400).json({ message: "This reset link is invalid or has expired." });
    }

    if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({
            message: "Password must contain at least 6 characters"
        });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    let connection;
    let transactionStarted = false;

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [resetRows] = await connection.query(
            `SELECT id, user_id FROM password_reset_tokens
             WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
             LIMIT 1 FOR UPDATE`,
            [tokenHash]
        );

        if (!resetRows.length) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(400).json({
                message: "This reset link is invalid or has expired."
            });
        }

        const userId = resetRows[0].user_id;
        const [updated] = await connection.query(
            "UPDATE users SET password_hash = ? WHERE id = ? AND role = 'user'",
            [passwordHash, userId]
        );

        if (!updated.affectedRows) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(400).json({
                message: "This reset link is invalid or has expired."
            });
        }

        const [used] = await connection.query(
            "UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL",
            [resetRows[0].id]
        );

        if (!used.affectedRows) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(400).json({
                message: "This reset link is invalid or has expired."
            });
        }

        await connection.commit();
        transactionStarted = false;
        res.json({ message: "Password reset successfully. You can now log in." });
    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch {
                // Preserve the original request error.
            }
        }
        console.error("Reset password error:", error);
        res.status(500).json({ message: "Unable to reset password right now" });
    } finally {
        if (connection) connection.release();
    }
});

router.get("/me", auth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, full_name, email, phone, role, created_at
             FROM users WHERE id = ?`,
            [req.user.id]
        );

        if (!rows.length) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("Me error:", error);
        res.status(500).json({ message: "Unable to load profile" });
    }
});

module.exports = router;

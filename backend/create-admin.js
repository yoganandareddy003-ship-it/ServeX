/*
    Run once from backend:

        node create-admin.js

    Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in backend/.env first.
*/

require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("./db");

async function createAdmin() {
    try {
        const adminName = (process.env.ADMIN_NAME || "").trim();
        const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD || "";

        if (!adminName || !adminEmail || adminPassword.length < 12) {
            throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of at least 12 characters in backend/.env.");
        }

        const passwordHash = await bcrypt.hash(adminPassword, 10);

        const [existing] = await db.query(
            "SELECT id FROM users WHERE email=? LIMIT 1",
            [adminEmail]
        );

        if (existing.length) {
            await db.query(
                `UPDATE users
                 SET full_name=?, password_hash=?, role='admin'
                 WHERE email=?`,
                [adminName, passwordHash, adminEmail]
            );

            console.log("Existing account promoted to admin.");
        } else {
            await db.query(
                `INSERT INTO users
                 (full_name, email, phone, password_hash, role)
                 VALUES (?, ?, ?, ?, 'admin')`,
                [
                    adminName,
                    adminEmail,
                    null,
                    passwordHash
                ]
            );

            console.log("Admin account created.");
        }

        console.log("");
    } catch (error) {
        console.error("Create admin error:", error);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

createAdmin();

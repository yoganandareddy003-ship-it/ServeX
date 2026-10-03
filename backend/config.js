require("dotenv").config();

const jwtSecret = process.env.JWT_SECRET || "";

if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
}

const corsOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

module.exports = { jwtSecret, corsOrigins };
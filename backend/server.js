require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const db = require("./db");
const { corsOrigins } = require("./config");

const app = express();

app.disable("x-powered-by");
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === "production" ? undefined : false
}));
app.use(cors({
    origin(origin, callback) {
        callback(null, !origin || corsOrigins.includes(origin));
    }
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb", parameterLimit: 100 }));

const frontendPath = path.join(__dirname, "..", "frontend");

console.log("Frontend path:", frontendPath);

app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({ ok: true, database: "Connected" });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({
            ok: false,
            database: "Disconnected",
            message: error.message
        });
    }
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/bookings", require("./routes/booking"));
app.use("/api/history", require("./routes/history"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/admin", require("./routes/admin"));

app.get("/api/services-list", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, service_name, description, price, duration_minutes, vehicle_type
             FROM services
             WHERE active = TRUE
             ORDER BY id`
        );
        res.json(rows);
    } catch (error) {
        console.error("Services list error:", error);
        res.status(500).json({ message: "Unable to load services" });
    }
});

app.use(express.static(frontendPath));

app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            message: "API route not found"
        });
    }

    res.sendFile(path.join(frontendPath, "index.html"));
});

app.use((err, req, res, next) => {
    console.error("Server Error:", err);
    res.status(500).json({
        message: "Internal server error"
    });
});

const PORT = Number(process.env.PORT || 5000);

const server = app.listen(PORT, () => {
    console.log(`ServeX running at http://localhost:${PORT}`);
});

server.on("error", error => {
    if (error.code === "EADDRINUSE") {
        console.error(
            `ServeX could not start because port ${PORT} is already in use. ` +
            "If ServeX is already running, keep using that instance; otherwise stop the process on this port or configure a different PORT."
        );
    } else {
        console.error("ServeX failed to start:", error.message);
    }

    process.exitCode = 1;
});

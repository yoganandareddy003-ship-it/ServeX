const nodemailer = require("nodemailer");

function isEmailConfigured() {
    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
    );
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function sendPasswordResetEmail({ email, fullName, resetUrl }) {
    if (!isEmailConfigured()) {
        throw new Error("SMTP is not configured");
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    const safeName = escapeHtml(fullName || "SERVEX rider");
    const safeUrl = escapeHtml(resetUrl);

    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "SERVEX - Reset Your Password",
        text: `Hello ${fullName || "SERVEX rider"},\n\nWe received a request to reset your SERVEX password.\n\nUse this link to create a new password:\n${resetUrl}\n\nThis link expires in 30 minutes.\n\nIf you did not request a password reset, you can ignore this email.\n\nSERVEX Bike Service`,
        html: `<p>Hello ${safeName},</p><p>We received a request to reset your SERVEX password.</p><p>Use the link below to create a new password.</p><p><a href="${safeUrl}">Reset Password</a></p><p>This link expires in 30 minutes.</p><p>If you did not request a password reset, you can ignore this email.</p><p>SERVEX Bike Service</p>`
    });
}

module.exports = { isEmailConfigured, sendPasswordResetEmail };
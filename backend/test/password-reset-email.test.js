const assert = require("node:assert/strict");
const test = require("node:test");

const nodemailer = require("nodemailer");
const { isEmailConfigured, sendPasswordResetEmail } = require("../utils/email");

const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];

function restoreEnvironment(original) {
    smtpKeys.forEach(key => {
        if (original[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = original[key];
        }
    });
}

test("detects whether SMTP credentials are configured", () => {
    const original = Object.fromEntries(smtpKeys.map(key => [key, process.env[key]]));

    try {
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
        assert.equal(isEmailConfigured(), false);

        process.env.SMTP_HOST = "smtp.example.com";
        process.env.SMTP_USER = "rider@example.com";
        process.env.SMTP_PASS = "app-password";
        assert.equal(isEmailConfigured(), true);
    } finally {
        restoreEnvironment(original);
    }
});

test("builds a plain-text and escaped HTML password reset email", async () => {
    const original = Object.fromEntries(smtpKeys.map(key => [key, process.env[key]]));
    const originalCreateTransport = nodemailer.createTransport;
    let transportOptions;
    let message;

    Object.assign(process.env, {
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_SECURE: "false",
        SMTP_USER: "rider@example.com",
        SMTP_PASS: "app-password",
        SMTP_FROM: "SERVEX <rider@example.com>"
    });
    nodemailer.createTransport = options => {
        transportOptions = options;
        return { sendMail: async options => { message = options; } };
    };

    try {
        await sendPasswordResetEmail({
            email: "rider@example.com",
            fullName: "<Rider>",
            resetUrl: "https://servex.example/reset-password.html?token=abc123"
        });
    } finally {
        nodemailer.createTransport = originalCreateTransport;
        restoreEnvironment(original);
    }

    assert.equal(transportOptions.host, "smtp.example.com");
    assert.equal(transportOptions.port, 587);
    assert.equal(transportOptions.auth.user, "rider@example.com");
    assert.equal(message.from, "SERVEX <rider@example.com>");
    assert.equal(message.to, "rider@example.com");
    assert.equal(message.subject, "SERVEX - Reset Your Password");
    assert.match(message.text, /expires in 30 minutes/);
    assert.match(message.html, /&lt;Rider&gt;/);
    assert.match(message.html, /Reset Password/);
});
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

process.env.JWT_SECRET = "servex-test-secret-with-more-than-32-characters";
process.env.CORS_ORIGINS = "https://customer.example, https://admin.example ";

const jwt = require("jsonwebtoken");
const { corsOrigins, jwtSecret } = require("../config");
const auth = require("../middleware/auth");

const backendDirectory = path.join(__dirname, "..");

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test("requires a JWT secret with at least 32 characters", () => {
    const result = spawnSync(
        process.execPath,
        ["-e", "process.env.JWT_SECRET = 'short'; require('./config');"],
        { cwd: backendDirectory, encoding: "utf8" }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET must be configured/);
});

test("parses and trims the CORS origin allow-list", () => {
    assert.deepEqual(corsOrigins, [
        "https://customer.example",
        "https://admin.example"
    ]);
});

test("rejects requests without a bearer token", () => {
    const response = createResponse();

    auth({ headers: {} }, response, () => assert.fail("next must not run"));

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.message, "Authentication required");
});

test("attaches claims for a valid bearer token", () => {
    const response = createResponse();
    const claims = { id: 42, role: "user" };
    const token = jwt.sign(claims, jwtSecret, { expiresIn: "1m" });
    const request = { headers: { authorization: `Bearer ${token}` } };
    let nextCalled = false;

    auth(
        request,
        response,
        () => { nextCalled = true; }
    );

    assert.equal(nextCalled, true);
    assert.equal(response.statusCode, 200);
    assert.equal(request.user.id, claims.id);
    assert.equal(request.user.role, claims.role);
});

test("rejects a token signed with a different secret", () => {
    const response = createResponse();
    const token = jwt.sign({ id: 42 }, "a-different-test-secret");

    auth(
        { headers: { authorization: `Bearer ${token}` } },
        response,
        () => assert.fail("next must not run")
    );

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.message, "Invalid or expired token");
});
const API_BASE = "/api";

function getToken() {
    return localStorage.getItem("servex_token");
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem("servex_user"));
    } catch {
        return null;
    }
}

function setSession(data) {
    localStorage.setItem("servex_token", data.token);
    localStorage.setItem("servex_user", JSON.stringify(data.user));
}

function clearSession() {
    localStorage.removeItem("servex_token");
    localStorage.removeItem("servex_user");
}

function requireLogin() {
    if (!getToken()) {
        window.location.href = "login.html";
        return false;
    }
    return true;
}

async function apiFetch(endpoint, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    if (options.body && typeof options.body !== "string") {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
    }

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (response.status === 401) {
        clearSession();
        window.location.href = "login.html";
        throw new Error(data.message || "Session expired");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

function logout() {
    clearSession();
    window.location.href = "login.html";
}

function formatDate(dateString) {
    if (!dateString) return "-";

    const date = new Date(dateString);

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatTime(timeString) {
    if (!timeString) return "-";

    const parts = timeString.toString().split(":");
    let hour = Number(parts[0]);
    const minute = parts[1] || "00";
    const suffix = hour >= 12 ? "PM" : "AM";

    hour = hour % 12 || 12;

    return `${hour}:${minute} ${suffix}`;
}

function money(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

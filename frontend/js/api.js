const API_BASE = "/api";

function getToken() {
    return localStorage.getItem("servex_token") ||
        sessionStorage.getItem("servex_token");
}

function getUser() {
    try {
        const user = localStorage.getItem("servex_user") ||
            sessionStorage.getItem("servex_user");
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
}

function setSession(data, remember = true) {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;

    otherStorage.removeItem("servex_token");
    otherStorage.removeItem("servex_user");
    storage.setItem("servex_token", data.token);
    storage.setItem("servex_user", JSON.stringify(data.user));
}

function clearSession() {
    localStorage.removeItem("servex_token");
    localStorage.removeItem("servex_user");
    sessionStorage.removeItem("servex_token");
    sessionStorage.removeItem("servex_user");
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

function appendCopyrightFooter() {
    if (document.querySelector(".site-copyright, .home-copyright")) return;

    const text = `© ${new Date().getFullYear()} SERVEX Bike Care. All rights reserved.`;
    const homeFooter = document.querySelector(".home-footer");

    if (homeFooter) {
        const copyright = document.createElement("small");
        copyright.className = "home-copyright";
        copyright.textContent = text;
        homeFooter.append(copyright);
        return;
    }

    const authCard = document.querySelector(".auth-card");
    if (authCard) {
        const copyright = document.createElement("small");
        copyright.className = "site-copyright auth-copyright";
        copyright.textContent = text;
        authCard.append(copyright);
        return;
    }

    const footer = document.createElement("footer");
    footer.className = "site-copyright";
    footer.textContent = text;
    (document.querySelector("main") || document.body).append(footer);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", appendCopyrightFooter, { once: true });
} else {
    appendCopyrightFooter();
}

function showToast(message, type = "success") {
    let region = document.getElementById("toastRegion");

    if (!region) {
        region = document.createElement("div");
        region.id = "toastRegion";
        region.className = "toast-region";
        region.setAttribute("aria-live", "polite");
        region.setAttribute("aria-relevant", "additions");
        document.body.append(region);
    }

    const toast = document.createElement("div");
    const isError = type === "error";
    toast.className = `toast ${isError ? "error" : "success"}`;
    toast.setAttribute("role", isError ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = isError ? "!" : "✓";

    const copy = document.createElement("span");
    copy.className = "toast-copy";
    copy.textContent = message;

    const closeButton = document.createElement("button");
    closeButton.className = "toast-dismiss";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Dismiss notification");
    closeButton.textContent = "×";

    toast.append(icon, copy, closeButton);
    region.append(toast);

    let dismissed = false;
    let timeoutId;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        window.clearTimeout(timeoutId);
        toast.classList.add("is-dismissed");
        window.setTimeout(() => toast.remove(), 180);
    };

    closeButton.addEventListener("click", dismiss);
    timeoutId = window.setTimeout(dismiss, 4500);
}

function logout() {
    if (!window.confirm("Are you sure you want to log out?")) return;

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

function dateMatchesRange(value, range) {
    if (!value || range === "all") return true;

    const dateString = String(value).slice(0, 10);
    const recordDate = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(recordDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    if (range === "year") {
        startDate.setMonth(0, 1);
    } else {
        startDate.setDate(startDate.getDate() - Number(range) + 1);
    }

    return recordDate >= startDate && recordDate <= today;
}

function printInvoicePdf(invoice) {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
        window.alert("Allow pop-ups to print or save the invoice as a PDF.");
        return;
    }

    const user = getUser();
    const invoiceNumber = `SERVEX-${invoice.invoice_id || invoice.id}`;
    const customerName = user?.full_name || "SERVEX Customer";
    const details = invoice.description || invoice.service_name || "Service completed";
    const escape = value => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escape(invoiceNumber)}</title>
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; padding: 48px; color: #0f172a; font: 14px/1.5 Arial, sans-serif; }
                main { max-width: 760px; margin: 0 auto; }
                header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 24px; border-bottom: 2px solid #10b981; }
                header p { margin: 0 0 6px; color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
                h1 { margin: 0; font-size: 28px; }
                header strong { color: #475569; }
                .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 28px 0; }
                .parties span, .parties strong { display: block; }
                .parties span { margin-bottom: 5px; color: #64748b; font-size: 11px; text-transform: uppercase; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 13px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
                th { color: #64748b; font-size: 11px; text-transform: uppercase; }
                td:last-child, th:last-child { text-align: right; }
                .total { display: flex; justify-content: flex-end; gap: 32px; margin-top: 20px; font-size: 16px; font-weight: 700; }
                footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; }
                @page { margin: 18mm; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <main>
                <header>
                    <div><p>SERVEX BIKE CARE</p><h1>Service Invoice</h1></div>
                    <strong>${escape(invoiceNumber)}</strong>
                </header>
                <section class="parties">
                    <div><span>Billed to</span><strong>${escape(customerName)}</strong></div>
                    <div><span>Invoice date</span><strong>${escape(formatDate(invoice.service_date))}</strong></div>
                    <div><span>Vehicle</span><strong>${escape(`${invoice.brand || ""} ${invoice.model || ""}`.trim() || "—")}</strong></div>
                    <div><span>Registration</span><strong>${escape(invoice.registration_number || "—")}</strong></div>
                </section>
                <table>
                    <thead><tr><th>Service</th><th>Description</th><th>Amount</th></tr></thead>
                    <tbody><tr><td>${escape(invoice.service_name || "Service")}</td><td>${escape(details)}</td><td>${escape(money(invoice.amount))}</td></tr></tbody>
                </table>
                <div class="total"><span>Total</span><span>${escape(money(invoice.amount))}</span></div>
                <footer>Thank you for choosing SERVEX Bike Care.</footer>
            </main>
        </body>
        </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
}

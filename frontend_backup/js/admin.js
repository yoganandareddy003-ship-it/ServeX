function requireAdmin() {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
        window.location.href = "admin-login.html";
        return false;
    }

    if (user.role !== "admin") {
        alert("Admin access required.");
        window.location.href = "dashboard.html";
        return false;
    }

    document.querySelectorAll("[data-admin-name]").forEach(el => {
        el.textContent = user.full_name || "Administrator";
    });

    return true;
}

function adminMessage(message, type = "success") {
    const box = document.getElementById("adminMessage");

    if (!box) {
        alert(message);
        return;
    }

    box.textContent = message;
    box.className =
        type === "success"
            ? "alert alert-success"
            : "alert alert-error";

    setTimeout(() => box.classList.add("hidden"), 3500);
}

function adminLogout() {
    clearSession();
    window.location.href = "admin-login.html";
}

function adminEscape(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

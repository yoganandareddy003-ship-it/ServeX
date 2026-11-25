document.addEventListener("DOMContentLoaded", async () => {
    if (!requireAdmin()) return;

    try {
        const stats = await apiFetch("/admin/stats");

        document.getElementById("adminUsers").textContent = stats.users;
        document.getElementById("adminVehicles").textContent = stats.vehicles;
        document.getElementById("adminBookings").textContent = stats.bookings;
        document.getElementById("adminPending").textContent = stats.pending;
        document.getElementById("adminCompleted").textContent = stats.completed;
        document.getElementById("adminRevenue").textContent = money(stats.revenue);
    } catch (error) {
        adminMessage(error.message, "error");
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    if (!requireLogin()) return;

    const user = getUser();

    document.querySelectorAll("[data-user-name]").forEach(el => {
        el.textContent = user?.full_name || "User";
    });

    try {
        const data = await apiFetch("/dashboard/stats");

        document.getElementById("totalVehicles").textContent =
            data.totalVehicles;

        document.getElementById("activeBookings").textContent =
            data.activeBookings;

        document.getElementById("completedServices").textContent =
            data.completedServices;

        document.getElementById("totalSpent").textContent =
            money(data.totalSpent);

        const reminderBox = document.getElementById("serviceReminderBox");
        const reminders = Array.isArray(data.upcomingReminders) ? data.upcomingReminders : [];

        if (reminders.length) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const reminderItems = reminders.map(item => {
                const rawDate = item.service_date;
                if (!rawDate) {
                    return `
                        <div class="reminder-item overdue">
                            <span class="reminder-date">Unknown date</span>
                            <div>
                                <strong>${item.brand} ${item.model}</strong>
                                <small>${item.service_name} • ${item.registration_number}</small>
                                <span class="reminder-tag overdue">Service overdue</span>
                            </div>
                        </div>
                    `;
                }

                const serviceDate = new Date(rawDate + "T12:00:00");
                const diffDays = Math.round((serviceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                let severity = "upcoming";
                let label = `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;

                if (Number.isNaN(diffDays) || !Number.isFinite(diffDays)) {
                    severity = "overdue";
                    label = "Service overdue";
                } else if (diffDays < 0) {
                    severity = "overdue";
                    label = diffDays === -1
                        ? "Service overdue (1 day)"
                        : `Service overdue (${Math.abs(diffDays)} days)`;
                } else if (diffDays === 0) {
                    severity = "due-soon";
                    label = "Due today";
                } else if (diffDays <= 4) {
                    severity = "due-soon";
                    label = `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
                } else {
                    severity = "upcoming";
                    label = `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
                }

                return `
                    <div class="reminder-item ${severity}">
                        <span class="reminder-date">${formatDate(item.service_date)}</span>
                        <div>
                            <strong>${item.brand} ${item.model}</strong>
                            <small>${item.service_name} • ${item.registration_number}</small>
                            <span class="reminder-tag ${severity}">${label}</span>
                        </div>
                    </div>
                `;
            }).join("");

            reminderBox.className = "reminder-banner";
            reminderBox.innerHTML = `
                <div class="reminder-header">⏰ Service reminders</div>
                <div class="reminder-list">${reminderItems}</div>
            `;
            reminderBox.classList.remove("hidden");
        } else {
            reminderBox.className = "reminder-banner empty-reminder";
            reminderBox.innerHTML = `
                <div class="reminder-header">⏰ Service reminders</div>
                <div class="reminder-list">
                    <div class="reminder-item neutral">
                        <span class="reminder-date">No due date</span>
                        <div>
                            <strong>No upcoming service bookings</strong>
                            <small>Book a service when your bike is ready.</small>
                        </div>
                    </div>
                </div>
            `;
            reminderBox.classList.remove("hidden");
        }

        const tbody = document.getElementById("recentBookings");

        if (!data.recentBookings.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty">
                        No service bookings yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.recentBookings.map(item => `
            <tr>
                <td>${item.brand} ${item.model}</td>
                <td>${item.registration_number}</td>
                <td>${item.service_name}</td>
                <td>${formatDate(item.service_date)}</td>
                <td>${formatTime(item.service_time)}</td>
                <td>
                    <span class="status ${item.status}">
                        ${item.status}
                    </span>
                </td>
            </tr>
        `).join("");

    } catch (error) {
        console.error(error);
    }
});

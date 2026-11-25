document.addEventListener("DOMContentLoaded", async () => {
    if (!requireLogin()) return;

    document.getElementById("dashboardSearch")
        .addEventListener("input", filterDashboardBookings);
    document.getElementById("dashboardDateRange")
        .addEventListener("change", filterDashboardBookings);

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

        renderMetricTrends(data.trends || {});

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
                    <td colspan="7" class="empty">
                        No service bookings yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.recentBookings.map(item => `
            <tr data-date="${String(item.service_date).slice(0, 10)}">
                <td>${escapeHtml(item.brand)} ${escapeHtml(item.model)}</td>
                <td>${escapeHtml(item.registration_number)}</td>
                <td>${escapeHtml(item.service_name)}</td>
                <td>${formatDate(item.service_date)}</td>
                <td>${formatTime(item.service_time)}</td>
                <td>
                    <span class="status ${dashboardStatusClass(item.status)}">
                        ${escapeHtml(dashboardStatusLabel(item.status))}
                    </span>
                </td>
                <td>${dashboardInvoiceAction(item)}</td>
            </tr>
        `).join("");

        tbody.querySelectorAll(".invoice-pdf-button").forEach(button => {
            button.addEventListener("click", () => {
                const invoice = data.recentBookings.find(item =>
                    String(item.invoice_id) === button.dataset.invoiceId
                );
                if (invoice) printInvoicePdf({
                    ...invoice,
                    amount: invoice.invoice_amount,
                    description: invoice.service_name
                });
            });
        });

        filterDashboardBookings();

    } catch (error) {
        console.error(error);
    }
});

function renderMetricTrends(trends) {
    const vehicleTrend = trends.vehiclesAdded || {};
    const vehicleChange = Number(vehicleTrend.recent || 0) -
        Number(vehicleTrend.previous || 0);
    const vehicleBadge = document.getElementById("vehiclesTrend");

    if (!vehicleTrend.recent && !vehicleTrend.previous) {
        setMetricTrend(vehicleBadge, "No new bikes in the last 180 days", "neutral");
    } else if (!vehicleTrend.previous) {
        setMetricTrend(vehicleBadge, `${vehicleTrend.recent} added in the last 90 days`, "up");
    } else {
        const changeLabel = vehicleChange > 0 ? `+${vehicleChange}` : String(vehicleChange);
        setMetricTrend(vehicleBadge, `${changeLabel} vs prior 90 days`, trendDirection(vehicleChange));
    }

    setPercentageTrend("bookingsTrend", trends.activeBookings);
    setPercentageTrend("servicesTrend", trends.completedServices);
    setPercentageTrend("spentTrend", trends.totalSpent);
}

function setPercentageTrend(elementId, trend = {}) {
    const recent = Number(trend.recent || 0);
    const previous = Number(trend.previous || 0);
    const badge = document.getElementById(elementId);
    const isSpending = elementId === "spentTrend";

    if (recent === 0 && previous === 0) {
        setMetricTrend(badge, "No activity in the last 180 days", "neutral");
        return;
    }

    if (previous === 0) {
        setMetricTrend(
            badge,
            isSpending ? "New spend in the last 90 days" : "New activity in the last 90 days",
            "up",
            isSpending
        );
        return;
    }

    const percentChange = Math.round(((recent - previous) / previous) * 100);
    const changeLabel = `${percentChange > 0 ? "+" : ""}${percentChange}% vs prior 90 days`;
    setMetricTrend(badge, changeLabel, trendDirection(percentChange), isSpending);
}

function trendDirection(change) {
    if (change > 0) return "up";
    if (change < 0) return "down";
    return "neutral";
}

function setMetricTrend(element, label, direction, invertColors = false) {
    element.textContent = label;
    element.className = `metric-trend ${direction}${invertColors ? " inverse" : ""}`;
    element.setAttribute("aria-label", label);
}

function filterDashboardBookings() {
    const query = document.getElementById("dashboardSearch")
        .value.trim().toLowerCase();
    const range = document.getElementById("dashboardDateRange").value;
    const rows = document.querySelectorAll("#recentBookings tr");
    let matchCount = 0;

    rows.forEach(row => {
        const searchableText = Array.from(row.cells)
            .slice(0, -1)
            .map(cell => cell.textContent)
            .join(" ")
            .toLowerCase();
        const matches = searchableText.includes(query) &&
            dateMatchesRange(row.dataset.date, range);
        row.hidden = !matches;
        if (matches) matchCount += 1;
    });

    document.getElementById("dashboardSearchEmpty").hidden = matchCount > 0 ||
        (!query && range === "all");
}

function dashboardInvoiceAction(item) {
    if (item.status !== "Completed" || !item.invoice_id || item.invoice_amount == null) {
        return `<span class="invoice-unavailable" title="Invoice available after service completion">—</span>`;
    }

    return `
        <button
            class="invoice-pdf-button"
            type="button"
            data-invoice-id="${item.invoice_id}"
            title="Print or save invoice as PDF"
            aria-label="Print or save invoice ${item.invoice_id} as PDF"
        ><span aria-hidden="true">↓</span> PDF</button>
    `;
}

function dashboardStatusClass(status) {
    return ["Pending", "Confirmed", "Completed", "Cancelled"].includes(status)
        ? status
        : "Unknown";
}

function dashboardStatusLabel(status) {
    return status === "Cancelled" ? "Canceled" : status;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

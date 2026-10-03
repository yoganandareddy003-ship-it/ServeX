document.addEventListener("DOMContentLoaded", async () => {
    if (!requireAdmin()) return;
    await loadAdminBookings();
});

async function loadAdminBookings() {
    try {
        const bookings = await apiFetch("/admin/bookings");
        const body = document.getElementById("bookingsBody");

        body.innerHTML = bookings.map(b => `
            <tr>
                <td>#${b.id}</td>
                <td>
                    <strong>${adminEscape(b.full_name)}</strong><br>
                    <small class="metadata-cell">${adminEscape(b.email)}</small>
                </td>
                <td>
                    ${adminEscape(b.brand)} ${adminEscape(b.model)}<br>
                    <small class="metadata-cell">${adminEscape(b.registration_number)}</small>
                </td>
                <td>${adminEscape(b.service_name)}</td>
                <td class="metadata-cell">${formatDate(b.service_date)}</td>
                <td class="metadata-cell">${formatTime(b.service_time)}</td>
                <td>${money(b.price)}</td>
                <td>
                    <select onchange="changeBookingStatus(${b.id}, this.value)">
                        ${["Pending","Confirmed","Completed","Cancelled"].map(s =>
                            `<option value="${s}" ${b.status === s ? "selected" : ""}>${s}</option>`
                        ).join("")}
                    </select>
                </td>
            </tr>
        `).join("");
    } catch (error) {
        await loadAdminBookings();
        adminMessage(error.message, "error");
    }
}

async function changeBookingStatus(id, status) {
    try {
        await apiFetch(`/admin/bookings/${id}/status`, {
            method: "PUT",
            body: { status }
        });

        adminMessage(`Booking #${id} marked ${status}.`);
        loadAdminBookings();
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

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
                <td>
                    ${b.requested_parts ? adminEscape(b.requested_parts) : "—"}
                    ${b.parts_description ? `<br><small class="metadata-cell">${adminEscape(b.parts_description)}</small>` : ""}
                </td>
                <td class="metadata-cell">${formatDate(b.service_date)}</td>
                <td class="metadata-cell">${formatTime(b.service_time)}</td>
                <td>
                    <strong>Service ${money(b.price)}</strong><br>
                    <small class="metadata-cell">Parts ${bookingPartsEstimate(b)}</small><br>
                    <small class="metadata-cell">Total ${bookingTotalEstimate(b)}</small>
                </td>
                <td>
                    <select onchange="changeBookingStatus(${b.id}, this.value)">
                        ${["Pending","Confirmed","Completed","Cancelled"].map(s =>
                            `<option value="${s}" ${b.status === s ? "selected" : ""}>${s}</option>`
                        ).join("")}
                    </select>
                </td>
                <td>${adminInvoiceAction(b)}</td>
            </tr>
        `).join("");

        body.querySelectorAll(".invoice-pdf-button").forEach(button => {
            button.addEventListener("click", () => {
                const booking = bookings.find(item =>
                    String(item.invoice_id) === button.dataset.invoiceId
                );

                if (booking) {
                    printInvoicePdf({
                        ...booking,
                        id: booking.invoice_id,
                        amount: booking.invoice_amount,
                        description: booking.invoice_description || booking.service_name
                    });
                }
            });
        });
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

function bookingPartsEstimate(booking) {
    const requested = Number(booking.requested_parts_count || 0);
    const priced = Number(booking.priced_parts_count || 0);

    if (!requested) return "—";
    if (requested !== priced) return "Pending confirmation";
    return money(booking.parts_price_total);
}

function bookingTotalEstimate(booking) {
    const requested = Number(booking.requested_parts_count || 0);
    const priced = Number(booking.priced_parts_count || 0);

    if (requested && requested !== priced) return "Pending confirmation";
    return money(Number(booking.price) + Number(booking.parts_price_total || 0));
}

function adminInvoiceAction(booking) {
    if (booking.status !== "Completed" || !booking.invoice_id || booking.invoice_amount == null) {
        return `<span class="invoice-unavailable" title="Bill available after service completion">—</span>`;
    }

    return `
        <button
            class="invoice-pdf-button"
            type="button"
            data-invoice-id="${booking.invoice_id}"
            title="Print or save bill as PDF"
            aria-label="Print or save bill for booking ${booking.id} as PDF"
        ><span aria-hidden="true">↓</span> PDF</button>
    `;
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

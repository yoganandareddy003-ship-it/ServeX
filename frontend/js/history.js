document.addEventListener("DOMContentLoaded", async () => {
    if (!requireLogin()) return;

    document.getElementById("historySearch")
        .addEventListener("input", filterHistory);
    document.getElementById("historyDateRange")
        .addEventListener("change", filterHistory);
    document.getElementById("clearHistoryFilters")
        .addEventListener("click", () => {
            document.getElementById("historySearch").value = "";
            document.getElementById("historyDateRange").value = "all";
            filterHistory();
        });

    try {
        const history = await apiFetch("/history");
        const tbody = document.getElementById("historyBody");

        if (!history.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty">
                        No completed service history available.
                    </td>
                </tr>
            `;
            return;
        }

        document.getElementById("historyControls").hidden = false;
        tbody.innerHTML = history.map(item => `
            <tr data-date="${String(item.service_date).slice(0, 10)}">
                <td>${formatDate(item.service_date)}</td>
                <td>${escapeHtml(item.brand)} ${escapeHtml(item.model)}</td>
                <td>${escapeHtml(item.registration_number)}</td>
                <td>${escapeHtml(item.service_name)}</td>
                <td>${escapeHtml(item.description || "-")}</td>
                <td>${money(item.amount)}</td>
                <td>
                    <span class="status ${statusClass(item.status)}">
                        ${escapeHtml(statusLabel(item.status))}
                    </span>
                </td>
                <td>${invoiceAction(item)}</td>
            </tr>
        `).join("");

        tbody.querySelectorAll(".invoice-pdf-button").forEach(button => {
            button.addEventListener("click", () => {
                const invoice = history.find(item => String(item.id) === button.dataset.invoiceId);
                if (invoice) printInvoicePdf(invoice);
            });
        });

        filterHistory();

    } catch (error) {
        document.getElementById("historyBody").innerHTML = `
            <tr>
                <td colspan="8" class="empty">${escapeHtml(error.message)}</td>
            </tr>
        `;
    }
});

function filterHistory() {
    const query = document.getElementById("historySearch")
        .value.trim().toLowerCase();
    const range = document.getElementById("historyDateRange").value;
    const rows = document.querySelectorAll("#historyBody tr");
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

    document.getElementById("historySearchEmpty").hidden = matchCount > 0 ||
        (!query && range === "all");
}

function invoiceAction(item) {
    if (item.status !== "Completed" || item.amount == null) {
        return `<span class="invoice-unavailable" title="Invoice available after service completion">—</span>`;
    }

    return `
        <button
            class="invoice-pdf-button"
            type="button"
            data-invoice-id="${item.id}"
            title="Print or save invoice as PDF"
            aria-label="Print or save invoice ${item.id} as PDF"
        ><span aria-hidden="true">↓</span> PDF</button>
    `;
}

function statusClass(status) {
    return String(status || "").replace(/[^a-zA-Z]/g, "");
}

function statusLabel(status) {
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

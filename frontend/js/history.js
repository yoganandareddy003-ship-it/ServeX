let historyRecords = [];
let historyPage = 1;

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
    document.getElementById("historyPageSize")
        .addEventListener("change", () => {
            historyPage = 1;
            renderHistory();
        });
    document.getElementById("historyPreviousPage")
        .addEventListener("click", () => {
            historyPage -= 1;
            renderHistory();
        });
    document.getElementById("historyNextPage")
        .addEventListener("click", () => {
            historyPage += 1;
            renderHistory();
        });
    document.getElementById("exportHistoryCsv")
        .addEventListener("click", exportHistoryCsv);

    try {
        const history = await apiFetch("/history");

        if (!history.length) {
            document.getElementById("historyBody").innerHTML = `
                <tr>
                    <td colspan="8" class="empty">
                        No completed service history available.
                    </td>
                </tr>
            `;
            return;
        }

        historyRecords = history;
        document.getElementById("historyControls").hidden = false;
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
    historyPage = 1;
    renderHistory(query, range);
}

function renderHistory(query, range) {
    const search = query ?? document.getElementById("historySearch").value.trim().toLowerCase();
    const dateRange = range ?? document.getElementById("historyDateRange").value;
    const filteredRecords = historyRecords.filter(item => {
        const searchableText = [
            item.brand,
            item.model,
            item.registration_number,
            item.service_name,
            item.description
        ].join(" ").toLowerCase();
        return searchableText.includes(search) &&
            dateMatchesRange(String(item.service_date).slice(0, 10), dateRange);
    });
    const pageSize = Number(document.getElementById("historyPageSize").value);
    const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    historyPage = Math.min(Math.max(historyPage, 1), pageCount);
    const start = (historyPage - 1) * pageSize;
    const pageRecords = filteredRecords.slice(start, start + pageSize);
    const tbody = document.getElementById("historyBody");

    tbody.innerHTML = pageRecords.map(item => `
        <tr>
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
            const invoice = pageRecords.find(item => String(item.id) === button.dataset.invoiceId);
            if (invoice) printInvoicePdf(invoice);
        });
    });

    document.getElementById("historySearchEmpty").hidden = filteredRecords.length > 0;
    document.getElementById("historyPagination").hidden = filteredRecords.length === 0;
    document.getElementById("historyPageSummary").textContent = filteredRecords.length
        ? `Showing ${start + 1}-${Math.min(start + pageSize, filteredRecords.length)} of ${filteredRecords.length} records`
        : "Showing 0 records";
    document.getElementById("historyPreviousPage").disabled = historyPage <= 1;
    document.getElementById("historyNextPage").disabled = historyPage >= pageCount;
}

function exportHistoryCsv() {
    const query = document.getElementById("historySearch").value.trim().toLowerCase();
    const range = document.getElementById("historyDateRange").value;
    const filteredRecords = historyRecords.filter(item => {
        const searchableText = [
            item.brand,
            item.model,
            item.registration_number,
            item.service_name,
            item.description
        ].join(" ").toLowerCase();
        return searchableText.includes(query) &&
            dateMatchesRange(String(item.service_date).slice(0, 10), range);
    });
    const columns = ["Date", "Vehicle", "Registration", "Service", "Description", "Amount", "Status"];
    const rows = filteredRecords.map(item => [
        String(item.service_date).slice(0, 10),
        `${item.brand} ${item.model}`,
        item.registration_number,
        item.service_name,
        item.description || "",
        item.amount,
        statusLabel(item.status)
    ]);
    const csv = [columns, ...rows]
        .map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
        .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `servex-service-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

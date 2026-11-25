document.addEventListener("DOMContentLoaded", async () => {
    if (!requireAdmin()) return;
    await loadAdminServiceHistory();
});

async function loadAdminServiceHistory() {
    try {
        const history = await apiFetch("/admin/history");
        const body = document.getElementById("historyBody");

        if (!history.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="8" class="table-empty-state">No service history available.</td>
                </tr>
            `;
            return;
        }

        body.innerHTML = history.map(item => `
            <tr>
                <td>#${item.id}</td>
                <td>
                    <strong>${adminEscape(item.full_name)}</strong><br>
                    <small class="metadata-cell">${adminEscape(item.email)}</small>
                </td>
                <td>
                    ${adminEscape(item.brand)} ${adminEscape(item.model)}<br>
                    <small class="metadata-cell">${adminEscape(item.registration_number)}</small>
                </td>
                <td>${adminEscape(item.service_name)}</td>
                <td class="metadata-cell">${formatDate(item.service_date)}</td>
                <td>${adminEscape(item.description || "—")}</td>
                <td>${money(item.amount)}</td>
                <td>
                    <span class="status-badge ${item.status === "Completed" ? "status-completed" : "status-cancelled"}">
                        ${adminEscape(item.status)}
                    </span>
                </td>
            </tr>
        `).join("");
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

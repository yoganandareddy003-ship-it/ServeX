document.addEventListener("DOMContentLoaded", async () => {
    if (!requireLogin()) return;

    try {
        const history = await apiFetch("/history");
        const tbody = document.getElementById("historyBody");

        if (!history.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty">
                        No completed service history available.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = history.map(item => `
            <tr>
                <td>${formatDate(item.service_date)}</td>
                <td>${escapeHtml(item.brand)} ${escapeHtml(item.model)}</td>
                <td>${escapeHtml(item.registration_number)}</td>
                <td>${escapeHtml(item.service_name)}</td>
                <td>${escapeHtml(item.description || "-")}</td>
                <td>${money(item.amount)}</td>
                <td>
                    <span class="status ${item.status}">
                        ${item.status}
                    </span>
                </td>
            </tr>
        `).join("");

    } catch (error) {
        document.getElementById("historyBody").innerHTML = `
            <tr>
                <td colspan="7" class="empty">${error.message}</td>
            </tr>
        `;
    }
});

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

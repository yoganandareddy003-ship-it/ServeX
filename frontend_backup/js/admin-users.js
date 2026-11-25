document.addEventListener("DOMContentLoaded", async () => {
    if (!requireAdmin()) return;
    await loadAdminUsers();
});

async function loadAdminUsers() {
    try {
        const users = await apiFetch("/admin/users");
        const body = document.getElementById("usersBody");

        body.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>
                    <strong>${adminEscape(u.full_name)}</strong><br>
                    <small>${adminEscape(u.email)}</small>
                </td>
                <td>${adminEscape(u.phone || "-")}</td>
                <td>${u.vehicle_count}</td>
                <td>
                    <span class="status ${u.role === "admin" ? "Confirmed" : "Pending"}">
                        ${u.role}
                    </span>
                </td>
                <td>${formatDate(u.created_at)}</td>
                <td>
                    <select onchange="changeRole(${u.id}, this.value)">
                        <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
                        <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
                    </select>
                    <button class="btn btn-danger btn-small"
                        onclick="deleteAdminUser(${u.id})">
                        Delete
                    </button>
                </td>
            </tr>
        `).join("");
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

async function changeRole(id, role) {
    try {
        await apiFetch(`/admin/users/${id}/role`, {
            method: "PUT",
            body: { role }
        });
        adminMessage("User role updated.");
        loadAdminUsers();
    } catch (error) {
        adminMessage(error.message, "error");
        loadAdminUsers();
    }
}

async function deleteAdminUser(id) {
    if (!confirm("Delete this user and their vehicle/booking records?")) return;

    try {
        await apiFetch(`/admin/users/${id}`, {
            method: "DELETE"
        });

        adminMessage("User deleted.");
        loadAdminUsers();
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

let editingServiceId = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!requireAdmin()) return;

    document.getElementById("serviceForm")
        .addEventListener("submit", saveAdminService);

    document.getElementById("closeServiceModal")
        .addEventListener("click", closeServiceModal);

    document.getElementById("cancelServiceModal")
        .addEventListener("click", closeServiceModal);

    loadAdminServices();
});

async function loadAdminServices() {
    try {
        const services = await apiFetch("/admin/services");
        const body = document.getElementById("servicesBody");

        body.innerHTML = services.map(s => `
            <tr>
                <td>${s.id}</td>
                <td><strong>${adminEscape(s.service_name)}</strong></td>
                <td>${adminEscape(s.description || "-")}</td>
                <td>${money(s.price)}</td>
                <td>${s.duration_minutes} min</td>
                <td>
                    <span class="status ${s.active ? "Confirmed" : "Cancelled"}">
                        ${s.active ? "Active" : "Inactive"}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-small"
                        onclick='editAdminService(${JSON.stringify(s)})'>
                        Edit
                    </button>
                    <button class="btn btn-danger btn-small"
                        onclick="deleteAdminService(${s.id})">
                        Delete
                    </button>
                </td>
            </tr>
        `).join("");
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

function openServiceModal() {
    editingServiceId = null;
    document.getElementById("serviceModalTitle").textContent = "Add Service";
    document.getElementById("serviceForm").reset();
    document.getElementById("serviceActive").checked = true;
    document.getElementById("serviceModal").classList.remove("hidden");
}

function editAdminService(s) {
    editingServiceId = s.id;
    document.getElementById("serviceModalTitle").textContent = "Edit Service";
    document.getElementById("serviceName").value = s.service_name;
    document.getElementById("serviceDescription").value = s.description || "";
    document.getElementById("servicePrice").value = s.price;
    document.getElementById("serviceDuration").value = s.duration_minutes;
    document.getElementById("serviceActive").checked = !!s.active;
    document.getElementById("serviceModal").classList.remove("hidden");
}

function closeServiceModal() {
    document.getElementById("serviceModal").classList.add("hidden");
}

async function saveAdminService(e) {
    e.preventDefault();

    const body = {
        service_name: document.getElementById("serviceName").value,
        description: document.getElementById("serviceDescription").value,
        price: document.getElementById("servicePrice").value,
        duration_minutes: document.getElementById("serviceDuration").value,
        active: document.getElementById("serviceActive").checked
    };

    try {
        if (editingServiceId) {
            await apiFetch(`/admin/services/${editingServiceId}`, {
                method: "PUT",
                body
            });
        } else {
            await apiFetch("/admin/services", {
                method: "POST",
                body
            });
        }

        closeServiceModal();
        adminMessage("Service saved.");
        loadAdminServices();
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

async function deleteAdminService(id) {
    if (!confirm("Delete this service?")) return;

    try {
        await apiFetch(`/admin/services/${id}`, {
            method: "DELETE"
        });

        adminMessage("Service deleted.");
        loadAdminServices();
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

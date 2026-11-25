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
    loadAdminParts();
});

async function loadAdminServices() {
    try {
        const services = await apiFetch("/admin/services");
        const body = document.getElementById("servicesBody");

        body.innerHTML = services.map(s => `
            <tr>
                <td>${s.id}</td>
                <td><strong>${adminEscape(s.service_name)}</strong></td>
                <td>
                    <select class="service-vehicle-type" data-service-id="${s.id}"
                        aria-label="Compatible bikes for ${adminEscape(s.service_name)}">
                        ${["Electric", "Petrol", "Both"].map(type => `
                            <option value="${type}" ${(s.vehicle_type || "Both") === type ? "selected" : ""}>${type}</option>
                        `).join("")}
                    </select>
                </td>
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

        body.querySelectorAll(".service-vehicle-type").forEach(select => {
            select.addEventListener("change", () => {
                const service = services.find(item =>
                    String(item.id) === select.dataset.serviceId
                );
                if (service) saveServiceVehicleType(service, select);
            });
        });
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

async function loadAdminParts() {
    try {
        const parts = await apiFetch("/admin/parts");
        const body = document.getElementById("partsBody");

        body.innerHTML = parts.map(part => `
            <tr>
                <td><strong>${adminEscape(part.part_name)}</strong></td>
                <td>${adminEscape(part.category)}</td>
                <td>${adminEscape(part.vehicle_type)}</td>
                <td>
                    <input class="part-price-input" type="number" min="0" step="0.01"
                        value="${part.price ?? ""}" placeholder="Not set"
                        aria-label="Price estimate for ${adminEscape(part.part_name)}"
                        data-part-id="${part.id}">
                </td>
                <td>
                    <button class="btn btn-secondary btn-small part-price-save"
                        type="button" data-part-id="${part.id}">Save price</button>
                </td>
            </tr>
        `).join("");

        body.querySelectorAll(".part-price-save").forEach(button => {
            button.addEventListener("click", () => {
                const input = body.querySelector(`.part-price-input[data-part-id="${button.dataset.partId}"]`);
                savePartPrice(button.dataset.partId, input, button);
            });
        });
    } catch (error) {
        adminMessage(error.message, "error");
    }
}

async function savePartPrice(partId, input, button) {
    const rawPrice = input.value.trim();
    const price = rawPrice === "" ? null : Number(rawPrice);

    if (price !== null && (!Number.isFinite(price) || price < 0)) {
        adminMessage("Enter a valid price of zero or greater.", "error");
        return;
    }

    input.disabled = true;
    button.disabled = true;

    try {
        const result = await apiFetch(`/admin/parts/${partId}/price`, {
            method: "PATCH",
            body: { price }
        });
        input.value = result.price ?? "";
        adminMessage("Bike part price updated.");
    } catch (error) {
        adminMessage(error.message, "error");
    } finally {
        input.disabled = false;
        button.disabled = false;
    }
}

async function saveServiceVehicleType(service, select) {
    const previousType = service.vehicle_type || "Both";
    const vehicleType = select.value;
    select.disabled = true;

    try {
        const result = await apiFetch(`/admin/services/${service.id}/vehicle-type`, {
            method: "PATCH",
            body: { vehicle_type: vehicleType }
        });
        service.vehicle_type = result.vehicle_type;
        select.value = result.vehicle_type;
        adminMessage("Compatible bike type updated.");
    } catch (error) {
        select.value = previousType;
        adminMessage(error.message, "error");
    } finally {
        select.disabled = false;
    }
}

function openServiceModal() {
    editingServiceId = null;
    document.getElementById("serviceModalTitle").textContent = "Add Service";
    document.getElementById("serviceForm").reset();
    document.getElementById("serviceActive").checked = true;
    document.getElementById("serviceVehicleType").value = "Both";
    document.getElementById("serviceModal").classList.remove("hidden");
}

function editAdminService(s) {
    editingServiceId = s.id;
    document.getElementById("serviceModalTitle").textContent = "Edit Service";
    document.getElementById("serviceName").value = s.service_name;
    document.getElementById("serviceDescription").value = s.description || "";
    document.getElementById("serviceVehicleType").value = s.vehicle_type || "Both";
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
        vehicle_type: document.getElementById("serviceVehicleType").value,
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

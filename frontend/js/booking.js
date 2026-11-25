const ALLOWED_BOOKING_TIMES = [
    "09:00:00",
    "10:00:00",
    "11:00:00",
    "12:00:00",
    "14:00:00",
    "15:00:00",
    "16:00:00",
    "17:00:00"
];

let bookingVehicles = [];
let bookingServices = [];
let bookingParts = [];
let partsLoadError = "";
let selectedVehicleId = "";
let selectedServiceId = "";
let selectedPartIds = [];
let selectedTime = "";

document.addEventListener("DOMContentLoaded", async () => {
    if (!requireLogin()) return;

    setMinBookingDate();

    document.getElementById("bookingForm")
        .addEventListener("submit", createBooking);

    document.getElementById("date")
        .addEventListener("change", updateBookingSummary);

    document.getElementById("partAction")
        .addEventListener("change", updateBookingSummary);

    document.querySelectorAll("[data-next-step]").forEach(button => {
        button.addEventListener("click", () => {
            showBookingStep(Number(button.dataset.nextStep));
        });
    });

    document.querySelectorAll("[data-previous-step]").forEach(button => {
        button.addEventListener("click", () => {
            showBookingStep(Number(button.dataset.previousStep));
        });
    });

    document.querySelectorAll(".booking-time-option").forEach(button => {
        button.addEventListener("click", () => selectBookingTime(button));
    });

    await loadBookingOptions();
    updateBookingSummary();
});

function setMinBookingDate() {
    const dateInput = document.getElementById("date");
    if (!dateInput) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateInput.min = today.toISOString().split("T")[0];

    if (dateInput.value && dateInput.value < dateInput.min) {
        dateInput.value = "";
    }
}

async function loadBookingOptions() {
    try {
        const [vehiclesResult, servicesResult, partsResult] = await Promise.allSettled([
            apiFetch("/vehicles"),
            fetchServices(),
            apiFetch("/bookings/parts")
        ]);

        if (vehiclesResult.status === "rejected") throw vehiclesResult.reason;
        if (servicesResult.status === "rejected") throw servicesResult.reason;

        bookingVehicles = vehiclesResult.value;
        bookingServices = servicesResult.value;
        bookingParts = partsResult.status === "fulfilled" ? partsResult.value : [];
        partsLoadError = partsResult.status === "rejected"
            ? partsResult.reason.message
            : "";

        renderVehicleOptions();
        renderPartOptions();
        const requestedVehicleId = new URLSearchParams(window.location.search)
            .get("vehicleId");

        if (bookingVehicles.some(vehicle => String(vehicle.id) === requestedVehicleId)) {
            selectBookingVehicle(requestedVehicleId);
        } else {
            renderServiceOptions();
            updateBookingControls();
        }

    } catch (error) {
        showBookingMessage(error.message, "error");
    }
}

function renderVehicleOptions() {
    const container = document.getElementById("vehicleOptions");

    if (!bookingVehicles.length) {
        container.innerHTML = `
            <div class="booking-empty-state">
                <strong>No bikes in your garage yet</strong>
                <p>Add a bike before booking a service.</p>
                <a href="my-vehicles.html">Go to My Vehicles <span aria-hidden="true">→</span></a>
            </div>
        `;
        return;
    }

    container.innerHTML = bookingVehicles.map(vehicle => `
        <button
            class="booking-vehicle-option"
            type="button"
            data-vehicle-id="${vehicle.id}"
            aria-pressed="false"
        >
            <span class="booking-vehicle-icon" aria-hidden="true">🏍️</span>
            <span class="booking-vehicle-copy">
                <strong>${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</strong>
                <span>${escapeHtml(vehicle.registration_number)}</span>
                <small>${vehicle.year || "Year not listed"}${vehicle.fuel_type ? ` · ${escapeHtml(vehicle.fuel_type)}` : ""}</small>
            </span>
            <span class="booking-choice-indicator" aria-hidden="true"></span>
        </button>
    `).join("");

    container.querySelectorAll(".booking-vehicle-option").forEach(button => {
        button.addEventListener("click", () => selectBookingVehicle(button.dataset.vehicleId));
    });
}

function renderServiceOptions() {
    const container = document.getElementById("serviceOptions");
    const services = getAvailableBookingServices();

    if (!selectedVehicleId) {
        container.innerHTML = `
            <div class="booking-empty-state">
                <strong>Select a bike first</strong>
                <p>Available services will be shown for your bike.</p>
            </div>
        `;
        return;
    }

    if (!services.length) {
        container.innerHTML = `
            <div class="booking-empty-state">
                <strong>No compatible service packages are available</strong>
                <p>Please contact the workshop for service options for this bike.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = services.map(service => `
        <button
            class="service-package-card${String(service.id) === selectedServiceId ? " selected" : ""}"
            type="button"
            data-service-id="${service.id}"
            aria-pressed="${String(service.id) === selectedServiceId}"
        >
            <span class="service-package-icon" aria-hidden="true">${getServiceIcon(service.service_name)}</span>
            <span class="service-package-copy">
                <strong>${escapeHtml(service.service_name)}</strong>
                <span>${escapeHtml(service.description || "Workshop service tailored to your bike.")}</span>
                <small>${service.duration_minutes ? `About ${Number(service.duration_minutes)} minutes` : "Duration confirmed by the workshop"}</small>
            </span>
            <span class="service-package-price">${money(service.price)}</span>
        </button>
    `).join("");

    container.querySelectorAll(".service-package-card").forEach(button => {
        button.addEventListener("click", () => selectBookingService(button.dataset.serviceId));
    });
}

function getAvailableBookingServices() {
    const vehicle = bookingVehicles.find(item => String(item.id) === selectedVehicleId);
    if (!vehicle) {
        return bookingServices;
    }

    const vehicleType = String(vehicle.fuel_type || "").toLowerCase();
    return bookingServices.filter(service => {
        const serviceType = String(service.vehicle_type || "Both").toLowerCase();
        return serviceType === "both" || serviceType === vehicleType;
    });
}

function getAvailableBookingParts() {
    const vehicle = bookingVehicles.find(item => String(item.id) === selectedVehicleId);
    if (!vehicle) return [];

    const fuelType = String(vehicle.fuel_type || "").toLowerCase();
    const vehicleType = fuelType.includes("electric")
        ? "electric"
        : fuelType.includes("petrol")
            ? "petrol"
            : "";

    return bookingParts.filter(part => {
        const partType = String(part.vehicle_type || "Both").toLowerCase();
        return partType === "both" || partType === vehicleType;
    });
}

function renderPartOptions() {
    const container = document.getElementById("partOptions");
    const parts = getAvailableBookingParts();

    if (partsLoadError) {
        container.innerHTML = `
            <div class="booking-empty-state">
                <strong>Bike parts are temporarily unavailable</strong>
                <p>${escapeHtml(partsLoadError)}</p>
            </div>
        `;
        return;
    }

    if (!selectedVehicleId) {
        container.innerHTML = `
            <div class="booking-empty-state">
                <strong>Select a bike first</strong>
                <p>Compatible parts will be shown for your bike.</p>
            </div>
        `;
        return;
    }

    if (!parts.length) {
        container.innerHTML = `
            <div class="booking-empty-state">
                <strong>No compatible parts are available</strong>
                <p>Please contact the workshop to describe your request.</p>
            </div>
        `;
        return;
    }

    const categories = [...new Set(parts.map(part => part.category))];
    container.innerHTML = categories.map(category => `
        <fieldset class="parts-category">
            <legend>${escapeHtml(category)}</legend>
            <div class="parts-category-options">
                ${parts.filter(part => part.category === category).map(part => `
                    <label class="part-option">
                        <input type="checkbox" value="${part.id}" ${selectedPartIds.includes(String(part.id)) ? "checked" : ""}>
                        <span class="part-option-copy">
                            <strong>${escapeHtml(part.part_name)}</strong>
                            <small>${part.price == null ? "Price pending" : money(part.price)}</small>
                        </span>
                    </label>
                `).join("")}
            </div>
        </fieldset>
    `).join("");

    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener("change", () => {
            const partId = String(input.value);
            selectedPartIds = input.checked
                ? [...selectedPartIds, partId]
                : selectedPartIds.filter(id => id !== partId);
            updatePartsSelection();
            updateBookingSummary();
        });
    });
}

function updatePartsSelection() {
    const count = selectedPartIds.length;
    const selectedParts = bookingParts.filter(part =>
        selectedPartIds.includes(String(part.id))
    );
    const partsArePriced = selectedParts.length > 0 &&
        selectedParts.every(part => part.price != null && Number.isFinite(Number(part.price)));
    const partsTotal = selectedParts.reduce((total, part) => total + Number(part.price || 0), 0);

    document.getElementById("partsSelectionSummary").textContent =
        `${count} part${count === 1 ? "" : "s"} selected${partsArePriced ? ` · Parts estimate ${money(partsTotal)}` : ""}.`;
    document.getElementById("partsMessage").textContent = count
        ? `${count} part${count === 1 ? "" : "s"} selected for ${document.getElementById("partAction").value.toLowerCase()}${partsArePriced ? "." : ". Some prices are pending workshop confirmation."}`
        : "Select at least one part to continue.";
    document.querySelector('[data-next-step="4"]').disabled = count === 0;
}

function getServiceIcon(serviceName) {
    const name = String(serviceName || "").toLowerCase();

    if (name.includes("oil")) return "◉";
    if (name.includes("brake")) return "⊙";
    if (name.includes("tyre") || name.includes("tire")) return "◎";
    if (name.includes("engine")) return "⚙";
    return "🔧";
}

function selectBookingVehicle(vehicleId) {
    selectedVehicleId = String(vehicleId);

    if (!getAvailableBookingServices().some(service => String(service.id) === selectedServiceId)) {
        selectedServiceId = "";
    }

    document.querySelectorAll(".booking-vehicle-option").forEach(button => {
        const selected = button.dataset.vehicleId === selectedVehicleId;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });

    const compatiblePartIds = new Set(
        getAvailableBookingParts().map(part => String(part.id))
    );
    selectedPartIds = selectedPartIds.filter(id => compatiblePartIds.has(id));
    renderPartOptions();
    updatePartsSelection();
    renderServiceOptions();
    updateBookingSummary();
    updateBookingControls();
    clearBookingMessage();
    showBookingStep(2);
    document.getElementById("stepPackageTitle").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function selectBookingService(serviceId) {
    selectedServiceId = String(serviceId);

    document.querySelectorAll(".service-package-card").forEach(button => {
        const selected = button.dataset.serviceId === selectedServiceId;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });

    updateBookingSummary();
    updateBookingControls();
    clearBookingMessage();
}

function selectBookingTime(button) {
    selectedTime = button.dataset.time;

    document.querySelectorAll(".booking-time-option").forEach(option => {
        const selected = option === button;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
    });

    updateBookingSummary();
    updateBookingControls();
}

function showBookingStep(step) {
    if (step === 2 && !selectedVehicleId) {
        showBookingMessage("Choose a bike before continuing.", "error");
        return;
    }

    if (step === 3 && !selectedServiceId) {
        showBookingMessage("Choose a service package before continuing.", "error");
        return;
    }

    if (step === 4 && !selectedPartIds.length) {
        showBookingMessage("Select at least one bike part before continuing.", "error");
        return;
    }

    document.querySelectorAll("[data-step-panel]").forEach(panel => {
        panel.hidden = Number(panel.dataset.stepPanel) !== step;
    });

    document.querySelectorAll("[data-step-indicator]").forEach(indicator => {
        const indicatorStep = Number(indicator.dataset.stepIndicator);
        indicator.classList.toggle("active", indicatorStep === step);
        indicator.classList.toggle("complete", indicatorStep < step);

        if (indicatorStep === step) {
            indicator.setAttribute("aria-current", "step");
        } else {
            indicator.removeAttribute("aria-current");
        }
    });

    clearBookingMessage();
    updateBookingSummary();
    updateBookingControls();
}

function updateBookingSummary() {
    const vehicle = bookingVehicles.find(item => String(item.id) === selectedVehicleId);
    const service = bookingServices.find(item => String(item.id) === selectedServiceId);
    const date = document.getElementById("date").value;

    document.getElementById("summaryBike").textContent = vehicle
        ? `${vehicle.brand} ${vehicle.model}`
        : "Not selected";
    document.getElementById("summaryRegistration").textContent =
        vehicle?.registration_number || "—";
    document.getElementById("summaryService").textContent =
        service?.service_name || "Not selected";
    document.getElementById("summaryParts").textContent = selectedPartIds.length
        ? `${selectedPartIds.length} selected`
        : "None selected";
    document.getElementById("summaryPartAction").textContent =
        document.getElementById("partAction").value;
    const selectedParts = bookingParts.filter(part =>
        selectedPartIds.includes(String(part.id))
    );
    const partsArePriced = selectedParts.length > 0 &&
        selectedParts.every(part => part.price != null && Number.isFinite(Number(part.price)));
    const partsTotal = selectedParts.reduce((total, part) => total + Number(part.price || 0), 0);
    const partsPrice = selectedParts.length === 0
        ? "—"
        : partsArePriced ? money(partsTotal) : "Pending confirmation";
    document.getElementById("summaryServicePrice").textContent = service
        ? money(service.price)
        : "—";
    document.getElementById("summaryPartsPrice").textContent = partsPrice;
    document.getElementById("summaryPrice").textContent = service
        ? partsArePriced
            ? money(Number(service.price) + partsTotal)
            : selectedParts.length
                ? "Parts price pending"
                : money(service.price)
        : "—";
    document.getElementById("summaryDate").textContent = date
        ? `${formatDate(date)}${selectedTime ? ` · ${formatTime(selectedTime)}` : ""}`
        : "Not selected";

    updateBookingControls();
}

function updateBookingControls() {
    document.querySelector('[data-next-step="2"]').disabled = !selectedVehicleId;
    document.querySelector('[data-next-step="3"]').disabled = !selectedServiceId;
    document.querySelector('[data-next-step="4"]').disabled = !selectedPartIds.length;
    document.getElementById("confirmBooking").disabled = !(
        selectedVehicleId &&
        selectedServiceId &&
        selectedPartIds.length &&
        document.getElementById("date").value &&
        selectedTime
    );
}

async function fetchServices() {
    const response = await fetch("/api/services-list");

    if (!response.ok) {
        throw new Error("Unable to load compatible service packages");
    }

    return response.json();
}

function updateSummary() {
    const bike = document.getElementById("bike");
    const service = document.getElementById("service");
    const date = document.getElementById("date");

    document.getElementById("summaryBike").textContent =
        bike.value ? bike.options[bike.selectedIndex].text : "Not selected";

    document.getElementById("summaryService").textContent =
        service.value
            ? service.options[service.selectedIndex].text.split(" — ")[0]
            : "Not selected";

    document.getElementById("summaryDate").textContent =
        date.value ? formatDate(date.value) : "Not selected";
}

async function createBooking(e) {
    e.preventDefault();

    if (!selectedVehicleId) {
        showBookingStep(1);
        showBookingMessage("Choose a bike before confirming your booking.", "error");
        return;
    }

    if (!selectedServiceId) {
        showBookingStep(2);
        showBookingMessage("Choose a service package before confirming your booking.", "error");
        return;
    }

    const selectedDate = document.getElementById("date").value;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!selectedDate || new Date(`${selectedDate}T00:00:00`) < today) {
        showBookingMessage("Please choose a valid date from today onward.", "error");
        return;
    }

    if (!ALLOWED_BOOKING_TIMES.includes(selectedTime)) {
        showBookingMessage("Please select a booking time within business hours (9:00 AM to 5:00 PM).", "error");
        return;
    }

    try {
        await apiFetch("/bookings", {
            method: "POST",
            body: {
                vehicle_id: selectedVehicleId,
                service_id: selectedServiceId,
                service_date: selectedDate,
                service_time: selectedTime,
                notes: document.getElementById("notes").value,
                part_ids: selectedPartIds.map(Number),
                part_action: document.getElementById("partAction").value,
                part_description: document.getElementById("partDescription").value.trim()
            }
        });

        resetBookingForm();
        clearBookingMessage();
        showToast("Booking confirmed successfully!");

    } catch (error) {
        showBookingMessage(error.message, "error");
    }
}

function resetBookingForm() {
    selectedVehicleId = "";
    selectedServiceId = "";
    selectedPartIds = [];
    selectedTime = "";
    document.getElementById("bookingForm").reset();

    document.querySelectorAll(".booking-vehicle-option, .service-package-card, .booking-time-option")
        .forEach(option => {
            option.classList.remove("selected");
            option.setAttribute("aria-pressed", "false");
        });

    setMinBookingDate();
    renderPartOptions();
    updatePartsSelection();
    showBookingStep(1);
    updateBookingSummary();
}

function showBookingMessage(message, type) {
    const box = document.getElementById("bookingMessage");
    box.textContent = message;
    box.className =
        type === "success"
            ? "alert alert-success"
            : "alert alert-error";
}

function clearBookingMessage() {
    const box = document.getElementById("bookingMessage");
    box.textContent = "";
    box.className = "alert hidden";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

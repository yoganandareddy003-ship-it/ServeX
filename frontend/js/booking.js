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
let selectedVehicleId = "";
let selectedServiceId = "";
let selectedTime = "";

document.addEventListener("DOMContentLoaded", async () => {
    if (!requireLogin()) return;

    setMinBookingDate();

    document.getElementById("bookingForm")
        .addEventListener("submit", createBooking);

    document.getElementById("date")
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
        [bookingVehicles, bookingServices] = await Promise.all([
            apiFetch("/vehicles"),
            fetchServices()
        ]);

        renderVehicleOptions();
        renderServiceOptions();
        updateBookingControls();

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

    if (!bookingServices.length) {
        container.innerHTML = `
            <div class="booking-empty-state">
                <strong>No service packages are available</strong>
                <p>Please try again later.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = bookingServices.map(service => `
        <button
            class="service-package-card"
            type="button"
            data-service-id="${service.id}"
            aria-pressed="false"
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

    document.querySelectorAll(".booking-vehicle-option").forEach(button => {
        const selected = button.dataset.vehicleId === selectedVehicleId;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });

    updateBookingSummary();
    updateBookingControls();
    clearBookingMessage();
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
    document.getElementById("summaryPrice").textContent =
        service ? money(service.price) : "—";
    document.getElementById("summaryDate").textContent = date
        ? `${formatDate(date)}${selectedTime ? ` · ${formatTime(selectedTime)}` : ""}`
        : "Not selected";

    updateBookingControls();
}

function updateBookingControls() {
    document.querySelector('[data-next-step="2"]').disabled = !selectedVehicleId;
    document.querySelector('[data-next-step="3"]').disabled = !selectedServiceId;
    document.getElementById("confirmBooking").disabled = !(
        selectedVehicleId &&
        selectedServiceId &&
        document.getElementById("date").value &&
        selectedTime
    );
}

async function fetchServices() {
    const response = await fetch("/api/services-list");

    if (!response.ok) {
        // Fallback to the same service list used by the SQL seed.
        return [
            { id: 1, service_name: "General Service", price: 799 },
            { id: 2, service_name: "Oil Change", price: 499 },
            { id: 3, service_name: "Brake Service", price: 599 },
            { id: 4, service_name: "Engine Repair", price: 1499 },
            { id: 5, service_name: "Tyre Service", price: 399 },
            { id: 6, service_name: "Full Service", price: 1999 }
        ];
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
                notes: document.getElementById("notes").value
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
    selectedTime = "";
    document.getElementById("bookingForm").reset();

    document.querySelectorAll(".booking-vehicle-option, .service-package-card, .booking-time-option")
        .forEach(option => {
            option.classList.remove("selected");
            option.setAttribute("aria-pressed", "false");
        });

    setMinBookingDate();
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

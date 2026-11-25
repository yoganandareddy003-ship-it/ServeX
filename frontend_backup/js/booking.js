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

document.addEventListener("DOMContentLoaded", async () => {
    if (!requireLogin()) return;

    setMinBookingDate();
    await loadBookingOptions();

    document.getElementById("bookingForm")
        .addEventListener("submit", createBooking);

    document.getElementById("bike")
        .addEventListener("change", updateSummary);

    document.getElementById("service")
        .addEventListener("change", updateSummary);

    document.getElementById("date")
        .addEventListener("change", updateSummary);
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
        const [vehicles, services] = await Promise.all([
            apiFetch("/vehicles"),
            fetchServices()
        ]);

        const bike = document.getElementById("bike");
        const service = document.getElementById("service");

        bike.innerHTML = `<option value="">Select bike</option>`;

        vehicles.forEach(v => {
            bike.innerHTML += `
                <option value="${v.id}">
                    ${escapeHtml(v.brand)} ${escapeHtml(v.model)}
                    — ${escapeHtml(v.registration_number)}
                </option>
            `;
        });

        service.innerHTML = `<option value="">Select service</option>`;

        services.forEach(s => {
            service.innerHTML += `
                <option value="${s.id}">
                    ${escapeHtml(s.service_name)} — ${money(s.price)}
                </option>
            `;
        });

        if (!vehicles.length) {
            showBookingMessage(
                "Please add a bike in My Vehicles before booking a service.",
                "error"
            );
        }

    } catch (error) {
        showBookingMessage(error.message, "error");
    }
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

    const selectedDate = document.getElementById("date").value;
    const selectedTime = document.getElementById("time").value;
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
                vehicle_id: document.getElementById("bike").value,
                service_id: document.getElementById("service").value,
                service_date: selectedDate,
                service_time: selectedTime,
                notes: document.getElementById("notes").value
            }
        });

        showBookingMessage(
            "Service booking confirmed successfully!",
            "success"
        );

        document.getElementById("bookingForm").reset();
        updateSummary();

    } catch (error) {
        showBookingMessage(error.message, "error");
    }
}

function showBookingMessage(message, type) {
    const box = document.getElementById("bookingMessage");
    box.textContent = message;
    box.className =
        type === "success"
            ? "alert alert-success"
            : "alert alert-error";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

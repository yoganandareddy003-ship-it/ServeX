let editingVehicleId = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!requireLogin()) return;

    loadVehicles();

    document.getElementById("vehicleForm")
        .addEventListener("submit", saveVehicle);

    document.getElementById("vehicleSearch")
        .addEventListener("input", filterVehicles);
    document.getElementById("clearVehicleSearch")
        .addEventListener("click", () => {
            document.getElementById("vehicleSearch").value = "";
            filterVehicles();
        });

    document.getElementById("closeModal")
        .addEventListener("click", closeModal);

    document.getElementById("cancelModal")
        .addEventListener("click", closeModal);
});


function getVehicleServiceStatus(vehicleId, bookings) {

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeBookings = bookings
        .filter(booking =>
            String(booking.vehicle_id) === String(vehicleId) &&
            ["Pending", "Confirmed"].includes(booking.status)
        )
        .map(booking => ({
            booking,
            date: parseServiceDate(booking.service_date)
        }))
        .filter(item => item.date)
        .sort((first, second) => first.date - second.date);

    const nextBooking = activeBookings.find(item => item.date >= today);

    if (nextBooking) {
        const daysUntilService = Math.round(
            (nextBooking.date - today) / (1000 * 60 * 60 * 24)
        );

        return {
            className: "scheduled",
            label: daysUntilService === 0
                ? "Service booked today"
                : `Service booked in ${daysUntilService} day${daysUntilService === 1 ? "" : "s"}`
        };
    }

    if (activeBookings.length) {
        return {
            className: "overdue",
            label: "Booking overdue"
        };
    }

    return {
        className: "unknown",
        label: "No upcoming booking"
    };
}


function parseServiceDate(value) {

    if (!value) return null;

    const dateString = typeof value === "string"
        ? value.slice(0, 10)
        : new Date(value).toISOString().slice(0, 10);
    const date = new Date(`${dateString}T12:00:00`);

    return Number.isNaN(date.getTime()) ? null : date;
}


/* =========================================================
   LOAD VEHICLES
========================================================= */

async function loadVehicles() {

    try {

        const [vehicles, bookings] = await Promise.all([
            apiFetch("/vehicles"),
            apiFetch("/bookings").catch(error => {
                console.warn("Unable to load vehicle service bookings:", error);
                return [];
            })
        ]);

        const container = document.getElementById("vehicleList");

        if (!vehicles.length) {

            document.getElementById("vehicleSearchPanel").hidden = true;
            document.getElementById("vehicleSearch").value = "";

            container.innerHTML = `
                <div class="card empty">

                    <div style="font-size:42px">🏍️</div>

                    <h3 style="margin:10px 0">
                        No bikes added
                    </h3>

                    <p>
                        Add your first vehicle to start
                        booking services.
                    </p>

                </div>
            `;

            return;
        }

        document.getElementById("vehicleSearchPanel").hidden = false;

        container.innerHTML = vehicles.map(v => {
            const serviceStatus = getVehicleServiceStatus(v.id, bookings);

            return `

            <article
                class="vehicle-card service-clickable"
                data-vehicle-id="${v.id}"
                title="Click to view service history"
            >

                <div class="vehicle-card-visual">
                    <div class="vehicle-visual-header">
                        <span class="vehicle-visual-label">SERVEX / GARAGE</span>
                        <span class="service-status-chip ${serviceStatus.className}">
                            ${escapeHtml(serviceStatus.label)}
                        </span>
                    </div>

                    <svg class="vehicle-silhouette" viewBox="0 0 180 100" role="img" aria-label="${escapeHtml(v.brand)} ${escapeHtml(v.model)} motorcycle silhouette">
                        <circle cx="43" cy="70" r="18"></circle>
                        <circle cx="139" cy="70" r="18"></circle>
                        <path d="M43 70h28l18-27h27l23 27h-30L91 53 77 70H61l13-20"></path>
                        <path d="M89 43h19l11 8h-22M113 43l8-12h13M134 70l8-18"></path>
                        <path d="M83 42l-8-7h-9M69 35h-8"></path>
                    </svg>
                </div>

                <div class="vehicle-card-heading">
                    <h3>
                        ${escapeHtml(v.brand)} ${escapeHtml(v.model)}
                    </h3>

                    <div class="registration-plate">
                        <span>Registration</span>
                        <strong>${escapeHtml(v.registration_number)}</strong>
                    </div>
                </div>

                <div class="mileage-meter" aria-label="Mileage not recorded">
                    <div class="mileage-meter-heading">
                        <span>Mileage</span>
                        <strong>Not recorded</strong>
                    </div>
                    <div class="mileage-meter-track" aria-hidden="true">
                        <span></span>
                    </div>
                    <p>Odometer reading not on file</p>
                </div>

                <div class="vehicle-details">

                    <div class="detail-row">
                        <span>Year</span>

                        <strong>
                            ${v.year || "-"}
                        </strong>
                    </div>


                    <div class="detail-row">
                        <span>Fuel</span>

                        <strong>
                            ${escapeHtml(v.fuel_type || "-")}
                        </strong>
                    </div>


                    <div class="detail-row">
                        <span>Color</span>

                        <strong>
                            ${escapeHtml(v.color || "-")}
                        </strong>
                    </div>

                </div>


                <div class="form-actions">

                    <button
                        class="btn btn-primary btn-small book-bike-btn"
                        type="button"
                    >
                        Book service
                    </button>

                    <button
                        class="btn btn-secondary btn-small edit-bike-btn"
                        type="button"
                    >
                        Edit
                    </button>


                    <button
                        class="btn btn-danger btn-small delete-bike-btn"
                    >
                        Delete
                    </button>

                </div>

            </article>

        `;
        }).join("");


        /*
        -----------------------------------------------------
        EDIT BUTTONS
        -----------------------------------------------------
        */

        container
            .querySelectorAll(".edit-bike-btn")
            .forEach((button, index) => {

                button.addEventListener("click", (event) => {

                    event.stopPropagation();

                    editVehicle(vehicles[index]);

                });

            });

        container
            .querySelectorAll(".book-bike-btn")
            .forEach((button, index) => {
                button.addEventListener("click", event => {
                    event.stopPropagation();
                    window.location.href = `book-service.html?vehicleId=${encodeURIComponent(vehicles[index].id)}`;
                });
            });


        /*
        -----------------------------------------------------
        DELETE BUTTONS
        -----------------------------------------------------
        */

        container
            .querySelectorAll(".delete-bike-btn")
            .forEach((button, index) => {

                button.addEventListener("click", (event) => {

                    event.stopPropagation();

                    deleteVehicle(vehicles[index].id);

                });

            });


        /*
        -----------------------------------------------------
        CLICK BIKE CARD
        -----------------------------------------------------
        */

        container
            .querySelectorAll(".vehicle-card")
            .forEach(card => {

                card.addEventListener("click", () => {

                    const vehicleId =
                        card.dataset.vehicleId;

                    openVehicleServiceHistory(vehicleId);

                });

            });


            filterVehicles();

    } catch (error) {

        console.error(error);

        showMessage(
            error.message,
            "error"
        );
    }
}


function filterVehicles() {

    const query = document.getElementById("vehicleSearch")
        .value.trim().toLocaleLowerCase();
    const cards = document.querySelectorAll("#vehicleList .vehicle-card");
    let matchCount = 0;

    cards.forEach(card => {
        const searchText = [
            card.querySelector("h3").textContent,
            card.querySelector(".registration-plate strong").textContent,
            card.querySelector(".vehicle-details").textContent
        ].join(" ").toLocaleLowerCase();
        const matches = searchText.includes(query);
        card.hidden = !matches;
        if (matches) matchCount += 1;
    });

    document.getElementById("vehicleSearchEmpty").hidden =
        !query || matchCount > 0;
}


/* =========================================================
   VEHICLE SERVICE HISTORY
========================================================= */

async function openVehicleServiceHistory(vehicleId) {

    try {

        showHistoryLoading();


        /*
        API:
        GET /api/history/vehicle/:vehicleId
        */

        const result = await apiFetch(
            `/history/vehicle/${vehicleId}`
        );


        console.log(
            "Vehicle service history:",
            result
        );


        if (!result || !result.vehicle) {

            closeHistoryModal();

            showMessage(
                "No service history found for this bike.",
                "error"
            );

            return;
        }


        createHistoryModal(result);


    } catch (error) {

        console.error(
            "Service history error:",
            error
        );

        closeHistoryModal();

        showMessage(
            error.message ||
            "Unable to load service history",
            "error"
        );
    }
}


/* =========================================================
   LOADING MODAL
========================================================= */

function showHistoryLoading() {

    removeExistingHistoryModal();


    const modal = document.createElement("div");

    modal.id = "vehicleHistoryModal";

    modal.className = "history-overlay";


    modal.innerHTML = `

        <div class="history-modal">

            <button
                class="history-close"
                onclick="closeHistoryModal()"
            >
                ×
            </button>


            <div class="history-loading">

                <div class="history-spinner"></div>

                <h3>
                    Loading service history...
                </h3>

                <p>
                    Please wait.
                </p>

            </div>

        </div>

    `;


    document.body.appendChild(modal);
}


/* =========================================================
   CREATE HISTORY MODAL
========================================================= */

function createHistoryModal(result) {

    removeExistingHistoryModal();


    const vehicle = result.vehicle;

    const summary = result.summary || {};

    const history = result.history || [];


    const totalServices =
        Number(summary.totalServices || 0);


    const totalAmount =
        Number(summary.totalAmount || 0);


    const completedServices =
        history.filter(
            item => item.status === "Completed"
        );


    const firstService =
        completedServices.length
            ? completedServices[
                completedServices.length - 1
              ].service_date
            : null;


    const lastService =
        completedServices.length
            ? completedServices[0].service_date
            : null;


    const modal =
        document.createElement("div");


    modal.id =
        "vehicleHistoryModal";


    modal.className =
        "history-overlay";


    modal.innerHTML = `

        <div class="history-modal">


            <!-- HEADER -->

            <div class="history-header">

                <div>

                    <div class="history-brand">
                        SERVEX BIKE CARE
                    </div>

                    <h2>
                        🏍️
                        ${escapeHtml(vehicle.brand)}
                        ${escapeHtml(vehicle.model)}
                    </h2>

                    <div class="history-registration">
                        ${escapeHtml(
                            vehicle.registration_number
                        )}
                    </div>

                </div>


                <button
                    class="history-close"
                    onclick="closeHistoryModal()"
                >
                    ×
                </button>

            </div>


            <!-- SUMMARY -->

            <div class="history-summary">


                <div class="history-stat">

                    <div class="history-stat-icon">
                        🔧
                    </div>

                    <div>

                        <span>
                            Total Services
                        </span>

                        <strong>
                            ${totalServices}
                        </strong>

                    </div>

                </div>


                <div class="history-stat">

                    <div class="history-stat-icon">
                        ₹
                    </div>

                    <div>

                        <span>
                            Total Spent
                        </span>

                        <strong>
                            ₹${formatAmount(totalAmount)}
                        </strong>

                    </div>

                </div>


                <div class="history-stat">

                    <div class="history-stat-icon">
                        📅
                    </div>

                    <div>

                        <span>
                            Last Service
                        </span>

                        <strong>
                            ${formatDate(lastService)}
                        </strong>

                    </div>

                </div>


                <div class="history-stat">

                    <div class="history-stat-icon">
                        🏁
                    </div>

                    <div>

                        <span>
                            First Service
                        </span>

                        <strong>
                            ${formatDate(firstService)}
                        </strong>

                    </div>

                </div>


            </div>


            <!-- HISTORY -->

            <div class="history-content">

                <div class="history-title">

                    <div>

                        <h3>
                            Service History
                        </h3>

                        <p>
                            Previous service records
                            for this vehicle
                        </p>

                    </div>

                    <div class="history-actions">
                        <div class="history-count">
                            ${history.length} Records
                        </div>

                        <button class="history-action history-print" type="button">
                            Print
                        </button>

                        <button class="history-action history-download" type="button">
                            Download CSV
                        </button>
                    </div>

                </div>


                ${
                    history.length
                    ? createHistoryTable(history)
                    : `
                        <div class="no-history">

                            <div>
                                🔧
                            </div>

                            <h3>
                                No service records
                            </h3>

                            <p>
                                This bike has no
                                recorded services.
                            </p>

                        </div>
                    `
                }

            </div>


        </div>

    `;


    document.body.appendChild(modal);

    modal.querySelector(".history-print").addEventListener("click", () => {
        window.print();
    });

    modal.querySelector(".history-download").addEventListener("click", () => {
        downloadVehicleHistory(vehicle, history);
    });


    /*
    Close when clicking outside modal
    */

    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {
                closeHistoryModal();
            }

        }
    );
}


function downloadVehicleHistory(vehicle, history) {

    const rows = [
        ["Vehicle", `${vehicle.brand} ${vehicle.model}`],
        ["Registration", vehicle.registration_number],
        [],
        ["Date", "Service", "Description", "Amount (INR)", "Status"],
        ...history.map(item => [
            formatDate(item.service_date),
            item.service_name || "Service",
            item.description || "-",
            Number(item.amount || 0).toFixed(2),
            item.status || ""
        ])
    ];

    const csv = rows.map(row => row.map(value => {
        const cell = String(value ?? "");
        const safeCell = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
        return `"${safeCell.replaceAll('"', '""')}"`;
    }).join(",")).join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `${vehicle.registration_number || "vehicle"}-service-history`
        .replace(/[^a-z0-9-]/gi, "-");

    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}


/* =========================================================
   CREATE HISTORY TABLE
========================================================= */

function createHistoryTable(history) {

    return `

        <div class="history-table-wrapper">

            <table class="history-table">

                <thead>

                    <tr>

                        <th>
                            DATE
                        </th>

                        <th>
                            SERVICE
                        </th>

                        <th>
                            DESCRIPTION
                        </th>

                        <th>
                            AMOUNT
                        </th>

                        <th>
                            STATUS
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${history.map(item => `

                        <tr>

                            <td>
                                <strong>
                                    ${formatDate(
                                        item.service_date
                                    )}
                                </strong>
                            </td>


                            <td>

                                <span class="service-name">

                                    🔧

                                    ${escapeHtml(
                                        item.service_name ||
                                        "Service"
                                    )}

                                </span>

                            </td>


                            <td>

                                <span class="description">

                                    ${escapeHtml(
                                        item.description ||
                                        "-"
                                    )}

                                </span>

                            </td>


                            <td>

                                <strong class="amount">

                                    ₹${formatAmount(
                                        item.amount
                                    )}

                                </strong>

                            </td>


                            <td>

                                <span
                                    class="
                                    status-badge
                                    ${
                                        item.status ===
                                        "Completed"
                                            ? "completed"
                                            : "cancelled"
                                    }
                                    "
                                >

                                    ${
                                        item.status ===
                                        "Completed"
                                            ? "✓ Completed"
                                            : "✕ Cancelled"
                                    }

                                </span>

                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        </div>

    `;
}


/* =========================================================
   CLOSE HISTORY MODAL
========================================================= */

function closeHistoryModal() {

    removeExistingHistoryModal();

}


/* =========================================================
   REMOVE MODAL
========================================================= */

function removeExistingHistoryModal() {

    const existing =
        document.getElementById(
            "vehicleHistoryModal"
        );


    if (existing) {

        existing.remove();

    }
}


/* =========================================================
   ADD VEHICLE MODAL
========================================================= */

function openAddModal() {

    editingVehicleId = null;

    document.getElementById(
        "modalTitle"
    ).textContent = "Add Bike";


    document.getElementById(
        "vehicleForm"
    ).reset();


    document.getElementById(
        "vehicleModal"
    ).classList.remove("hidden");
}


/* =========================================================
   EDIT VEHICLE
========================================================= */

function editVehicle(vehicle) {

    editingVehicleId = vehicle.id;


    document.getElementById(
        "modalTitle"
    ).textContent = "Edit Bike";


    document.getElementById("brand").value =
        vehicle.brand || "";


    document.getElementById("model").value =
        vehicle.model || "";


    document.getElementById("registration").value =
        vehicle.registration_number || "";


    document.getElementById("year").value =
        vehicle.year || "";


    document.getElementById("fuel").value =
        vehicle.fuel_type || "";


    document.getElementById("color").value =
        vehicle.color || "";


    document.getElementById("purchaseDate").value =
        vehicle.purchase_date
            ? String(
                vehicle.purchase_date
            ).slice(0, 10)
            : "";


    document.getElementById(
        "vehicleModal"
    ).classList.remove("hidden");
}


/* =========================================================
   CLOSE ADD / EDIT MODAL
========================================================= */

function closeModal() {

    document.getElementById(
        "vehicleModal"
    ).classList.add("hidden");

}


/* =========================================================
   SAVE VEHICLE
========================================================= */

async function saveVehicle(e) {

    e.preventDefault();


    const body = {

        brand:
            document.getElementById(
                "brand"
            ).value,

        model:
            document.getElementById(
                "model"
            ).value,

        registration_number:
            document.getElementById(
                "registration"
            ).value,

        year:
            document.getElementById(
                "year"
            ).value || null,

        fuel_type:
            document.getElementById(
                "fuel"
            ).value,

        color:
            document.getElementById(
                "color"
            ).value,

        purchase_date:
            document.getElementById(
                "purchaseDate"
            ).value || null
    };


    try {

        if (editingVehicleId) {

            await apiFetch(
                `/vehicles/${editingVehicleId}`,
                {
                    method: "PUT",
                    body
                }
            );

            showMessage(
                "Bike updated successfully",
                "success"
            );

        } else {

            await apiFetch(
                "/vehicles",
                {
                    method: "POST",
                    body
                }
            );

            showMessage(
                "Bike added successfully",
                "success"
            );

        }


        closeModal();

        loadVehicles();


    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

}


/* =========================================================
   DELETE VEHICLE
========================================================= */

async function deleteVehicle(id) {

    if (
        !confirm(
            "Delete this bike?"
        )
    ) {
        return;
    }


    try {

        await apiFetch(
            `/vehicles/${id}`,
            {
                method: "DELETE"
            }
        );


        showMessage(
            "Bike deleted successfully",
            "success"
        );


        loadVehicles();


    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    message,
    type
) {
    if (type === "success") {
        showToast(message);
        return;
    }

    const box =
        document.getElementById(
            "pageMessage"
        );


    box.textContent =
        message;


    box.className =
        type === "success"
            ? "alert alert-success"
            : "alert alert-error";


    setTimeout(
        () => {
            box.classList.add(
                "hidden"
            );
        },
        3500
    );

}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(date) {

    if (!date) {
        return "-";
    }


    const d =
        new Date(date);


    if (isNaN(d.getTime())) {
        return "-";
    }


    return d.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================================
   FORMAT MONEY
========================================================= */

function formatAmount(amount) {

    return Number(
        amount || 0
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}
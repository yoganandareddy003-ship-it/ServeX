document.addEventListener("DOMContentLoaded", loadHomeServices);

async function loadHomeServices() {
    const serviceList = document.getElementById("homeServiceList");
    if (!serviceList) return;

    try {
        const response = await fetch("/api/services-list");
        if (!response.ok) throw new Error("Unable to load services");

        const services = await response.json();
        if (!Array.isArray(services) || !services.length) {
            serviceList.innerHTML = `
                <p class="home-service-status" role="status">
                    No service packages are available right now.
                </p>
            `;
            return;
        }

        serviceList.innerHTML = services.map((service, index) => {
            const duration = Number(service.duration_minutes);
            const durationLabel = Number.isFinite(duration) && duration > 0
                ? `<small>About ${duration} minutes</small>`
                : "";

            return `
                <a class="home-feature home-service-link" href="register.html">
                    <span class="home-feature-number">${String(index + 1).padStart(2, "0")}</span>
                    <div>
                        <h3>${escapeHomeHtml(service.service_name)}</h3>
                        <p>${escapeHomeHtml(service.description || "Bike service from SERVEX.")}</p>
                        ${durationLabel}
                    </div>
                    <span class="home-feature-arrow" aria-hidden="true">↗</span>
                </a>
            `;
        }).join("");
    } catch {
        serviceList.innerHTML = `
            <p class="home-service-status" role="status">
                Services are temporarily unavailable. Please try again soon.
            </p>
        `;
    }
}

function escapeHomeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
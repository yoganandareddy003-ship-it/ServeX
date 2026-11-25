document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("adminLoginForm");

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const alertBox = document.getElementById("adminLoginAlert");
        alertBox.className = "alert hidden";

        try {
            const data = await apiFetch("/auth/login", {
                method: "POST",
                body: {
                    email: document.getElementById("email").value,
                    password: document.getElementById("password").value
                }
            });

            if (data.user.role !== "admin") {
                throw new Error("This account does not have administrator access.");
            }

            setSession(data);
            window.location.href = "admin-dashboard.html";
        } catch (error) {
            alertBox.textContent = error.message;
            alertBox.className = "alert alert-error";
        }
    });
});

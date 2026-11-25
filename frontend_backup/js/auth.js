document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const alertBox = document.getElementById("loginAlert");
            alertBox.className = "alert hidden";

            try {
                const data = await apiFetch("/auth/login", {
                    method: "POST",
                    body: {
                        email: document.getElementById("email").value,
                        password: document.getElementById("password").value
                    }
                });

                setSession(data);
                window.location.href = "dashboard.html";
            } catch (error) {
                alertBox.textContent = error.message;
                alertBox.className = "alert alert-error";
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const alertBox = document.getElementById("registerAlert");
            alertBox.className = "alert hidden";

            const password = document.getElementById("password").value;
            const confirm = document.getElementById("confirmPassword").value;

            if (password !== confirm) {
                alertBox.textContent = "Passwords do not match";
                alertBox.className = "alert alert-error";
                return;
            }

            try {
                const data = await apiFetch("/auth/register", {
                    method: "POST",
                    body: {
                        full_name: document.getElementById("fullName").value,
                        email: document.getElementById("email").value,
                        phone: document.getElementById("phone").value,
                        password
                    }
                });

                setSession(data);
                window.location.href = "dashboard.html";
            } catch (error) {
                alertBox.textContent = error.message;
                alertBox.className = "alert alert-error";
            }
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const forgotForm = document.getElementById("forgotPasswordForm");
    const resetForm = document.getElementById("resetPasswordForm");

    if (forgotForm) {
        forgotForm.addEventListener("submit", async event => {
            event.preventDefault();
            const alertBox = document.getElementById("forgotPasswordAlert");
            alertBox.className = "alert hidden";

            try {
                const result = await apiFetch("/auth/forgot-password", {
                    method: "POST",
                    body: { email: document.getElementById("email").value }
                });
                alertBox.textContent = result.message;
                alertBox.className = "alert alert-success";

                if (result.resetUrl) {
                    const link = document.createElement("a");
                    link.href = result.resetUrl;
                    link.textContent = " Open password reset";
                    link.rel = "noopener noreferrer";
                    alertBox.append(link);
                }
            } catch (error) {
                alertBox.textContent = error.message;
                alertBox.className = "alert alert-error";
            }
        });
    }

    if (resetForm) {
        const alertBox = document.getElementById("resetPasswordAlert");
        const token = new URLSearchParams(window.location.search).get("token");

        if (!token) {
            alertBox.textContent = "This reset link is invalid or incomplete.";
            alertBox.className = "alert alert-error";
            resetForm.querySelector("button[type='submit'], button:not([type])").disabled = true;
            return;
        }

        resetForm.addEventListener("submit", async event => {
            event.preventDefault();
            alertBox.className = "alert hidden";

            const password = document.getElementById("password").value;
            const confirmation = document.getElementById("confirmPassword").value;

            if (password !== confirmation) {
                alertBox.textContent = "Passwords do not match.";
                alertBox.className = "alert alert-error";
                return;
            }

            try {
                const result = await apiFetch("/auth/reset-password", {
                    method: "POST",
                    body: { token, password }
                });
                resetForm.hidden = true;
                alertBox.textContent = result.message;
                alertBox.className = "alert alert-success";
            } catch (error) {
                alertBox.textContent = error.message;
                alertBox.className = "alert alert-error";
            }
        });
    }
});
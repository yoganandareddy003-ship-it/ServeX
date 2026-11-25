document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".password-toggle").forEach(button => {
        const passwordInput = document.getElementById(button.getAttribute("aria-controls"));
        if (!passwordInput) return;

        const openEye = button.querySelector("[data-eye-open]");
        const closedEye = button.querySelector("[data-eye-closed]");

        button.addEventListener("click", () => {
            const showPassword = passwordInput.type === "password";
            passwordInput.type = showPassword ? "text" : "password";
            button.setAttribute("aria-pressed", String(showPassword));
            button.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
            button.title = showPassword ? "Hide password" : "Show password";
            openEye.hidden = showPassword;
            closedEye.hidden = !showPassword;
            passwordInput.focus();
        });
    });
});
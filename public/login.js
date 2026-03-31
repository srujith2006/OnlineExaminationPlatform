(() => {
  const { state, api } = window.AppApi;
  const { getEl, showToast } = window.AppUi;
  const { decodeRoleFromToken } = window.AppAuth;

  if (state.token) {
    window.location.href = state.role === "teacher" ? "/admin.html" : "/student.html";
    return;
  }

  const loginForm = getEl("loginForm");
  const registerForm = getEl("registerForm");
  const changePasswordForm = getEl("changePasswordForm");
  const authTitle = getEl("authTitle");
  const showRegisterLink = getEl("showRegisterLink");
  const showLoginLink = getEl("showLoginLink");
  const showChangePasswordLink = getEl("showChangePasswordLink");
  const showLoginFromChangeLink = getEl("showLoginFromChangeLink");

  const switchAuthTab = (mode) => {
    const isLogin = mode === "login";
    const isRegister = mode === "register";
    const isChangePassword = mode === "change-password";

    loginForm.classList.toggle("hidden", !isLogin);
    registerForm.classList.toggle("hidden", !isRegister);
    changePasswordForm.classList.toggle("hidden", !isChangePassword);

    if (authTitle) {
      if (isLogin) {
        authTitle.innerHTML = "Welcome Back <span class='wave'>Hi</span>";
      } else if (isRegister) {
        authTitle.innerHTML = "Create Account";
      } else {
        authTitle.innerHTML = "Change Password";
      }
    }
  };

  showRegisterLink?.addEventListener("click", () => switchAuthTab("register"));
  showLoginLink?.addEventListener("click", () => switchAuthTab("login"));
  showChangePasswordLink?.addEventListener("click", () => switchAuthTab("change-password"));
  showLoginFromChangeLink?.addEventListener("click", () => switchAuthTab("login"));

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const email = getEl("loginEmail").value.trim();
      const password = getEl("loginPassword").value;
      const data = await api("/api/users/login", "POST", { email, password });
      state.token = data.token;
      state.role = data.role || decodeRoleFromToken(data.token);
      state.name = data.name || "";
      localStorage.setItem("token", state.token);
      localStorage.setItem("role", state.role);
      localStorage.setItem("name", state.name);
      window.location.href = state.role === "teacher" ? "/admin.html" : "/student.html";
    } catch (err) {
      showToast(err.message, true);
    }
  });

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/users/register", "POST", {
        name: getEl("regName").value.trim(),
        email: getEl("regEmail").value.trim(),
        password: getEl("regPassword").value,
        role: getEl("regRole").value,
      });
      showToast("Account created. Please login.");
      switchAuthTab("login");
    } catch (err) {
      showToast(err.message, true);
    }
  });

  changePasswordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const email = getEl("cpEmail").value.trim();
      const currentPassword = getEl("cpCurrentPassword").value;
      const newPassword = getEl("cpNewPassword").value;
      const confirmNewPassword = getEl("cpConfirmPassword").value;

      if (newPassword !== confirmNewPassword) {
        showToast("New passwords do not match", true);
        return;
      }

      const data = await api("/api/users/change-password", "POST", {
        email,
        currentPassword,
        newPassword,
      });
      showToast(data.message || "Password changed successfully");
      switchAuthTab("login");
    } catch (err) {
      showToast(err.message, true);
    }
  });
})();

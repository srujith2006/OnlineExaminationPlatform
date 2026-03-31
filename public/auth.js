window.AppAuth = (() => {
  function decodeRoleFromToken(token) {
    const { state } = window.AppApi;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.role || state.role || "student";
    } catch (err) {
      return state.role || "student";
    }
  }

  function clearSession() {
    const { state } = window.AppApi;
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    state.token = "";
    state.role = "";
    state.name = "";
  }

  function setupTopbar(onLogout) {
    const { state } = window.AppApi;
    const { getEl } = window.AppUi;
    const badge = getEl("userBadge");
    const logoutBtn = getEl("logoutBtn");

    if (badge) {
      badge.classList.remove("hidden");
      badge.textContent = (state.role || "student").toUpperCase();
    }
    if (logoutBtn) {
      logoutBtn.classList.remove("hidden");
      logoutBtn.addEventListener("click", () => {
        clearSession();
        if (typeof onLogout === "function") onLogout();
        window.location.href = "/login.html";
      });
    }
  }

  function requireAuth(requiredRole) {
    const { state } = window.AppApi;
    if (!state.token) {
      window.location.href = "/login.html";
      return false;
    }
    if (requiredRole && state.role !== requiredRole) {
      window.location.href = state.role === "teacher" ? "/admin.html" : "/student.html";
      return false;
    }
    return true;
  }

  return {
    decodeRoleFromToken,
    clearSession,
    setupTopbar,
    requireAuth,
  };
})();

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import Toast from "../components/Toast";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [show, setShow] = useState({
    loginPassword: false,
    registerPassword: false,
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false,
    forgotNewPassword: false,
    forgotConfirmPassword: false
  });
  const [toast, setToast] = useState({ msg: "", error: false });
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    section: "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
    forgotNewPassword: "",
    forgotConfirmPassword: "",
    role: "student"
  });
  const { login, token, role } = useAuth();
  const navigate = useNavigate();

  if (token) {
    navigate(role === "student" ? "/student" : "/admin", { replace: true });
  }

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleShow = (key) => setShow((prev) => ({ ...prev, [key]: !prev[key] }));

  const onLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await apiRequest("/api/users/login", {
        method: "POST",
        body: { email: form.email, password: form.password, section: form.section }
      });
      login({ token: data.token, role: data.role, name: data.name, section: data.section });
      navigate(data.role === "student" ? "/student" : "/admin", { replace: true });
    } catch (err) {
      setToast({ msg: err.message, error: true });
    }
  };

  const onRegister = async (e) => {
    e.preventDefault();
    try {
      await apiRequest("/api/users/register", {
        method: "POST",
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          section: form.section
        }
      });
      setToast({ msg: "Account created. Please login.", error: false });
      setMode("login");
    } catch (err) {
      setToast({ msg: err.message, error: true });
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmNewPassword) {
      setToast({ msg: "New passwords do not match", error: true });
      return;
    }
    try {
      const data = await apiRequest("/api/users/change-password", {
        method: "POST",
        body: {
          email: form.email,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        }
      });
      setToast({ msg: data.message || "Request sent to admin for approval", error: false });
      setForm((prev) => ({
        ...prev,
        password: "",
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: ""
      }));
    } catch (err) {
      setToast({ msg: err.message, error: true });
    }
  };

  const onCheckPasswordRequestStatus = async () => {
    if (!form.email.trim()) {
      setToast({ msg: "Enter your email first", error: true });
      return;
    }
    try {
      const data = await apiRequest(
        `/api/users/change-password/status?email=${encodeURIComponent(form.email.trim())}`
      );
      setToast({ msg: data.message || "Status fetched", error: data.status === "rejected" });
      if (data.status === "approved" || data.status === "rejected") {
        setMode("login");
      }
    } catch (err) {
      setToast({ msg: err.message, error: true });
    }
  };

  const onForgotPasswordRequest = async (e) => {
    e.preventDefault();
    if (form.forgotNewPassword !== form.forgotConfirmPassword) {
      setToast({ msg: "New passwords do not match", error: true });
      return;
    }
    try {
      const data = await apiRequest("/api/users/forgot-password-request", {
        method: "POST",
        body: {
          email: form.email,
          newPassword: form.forgotNewPassword
        }
      });
      setToast({ msg: data.message || "Forgot password request sent to admin", error: false });
      setForm((prev) => ({
        ...prev,
        forgotNewPassword: "",
        forgotConfirmPassword: ""
      }));
    } catch (err) {
      setToast({ msg: err.message, error: true });
    }
  };

  return (
    <div className="app-shell role-login">
      <main className="login-shell">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo">EP</div>
            <div>
              <p className="login-brand-name">Online Examination Portal</p>
              <p className="login-brand-tagline">Secure your future.</p>
            </div>
          </div>
          <div className="login-headline">
            <h2>
              {mode === "login"
                ? "Welcome Back"
                : mode === "register"
                  ? "Create Account"
                  : mode === "change-password"
                    ? "Change Password"
                    : "Forgot Password"}
            </h2>
            <p>
              {mode === "login"
                ? "Please login to your account."
                : mode === "register"
                  ? "Join DigiPariksha in minutes."
                  : mode === "change-password"
                    ? "Update your password securely."
                    : "Request a password reset."}
            </p>
          </div>
          <form
            className="login-form"
            onSubmit={
              mode === "login"
                ? onLogin
                : mode === "register"
                  ? onRegister
                  : mode === "change-password"
                    ? onChangePassword
                    : onForgotPasswordRequest
            }
          >
            {mode === "register" && (
              <label className="field">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g., Priya Shah"
                  required
                />
              </label>
            )}
            <label className="field">
              <span>Email Address</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="e.g., mail@examportal.com"
                required
              />
            </label>
            {(mode === "login" || mode === "register") && (
              <label className="field">
                <span>Section (Students)</span>
                <input
                  value={form.section}
                  onChange={(e) => setField("section", e.target.value)}
                  placeholder="e.g., A"
                />
              </label>
            )}
            {mode === "login" && (
              <label className="field">
                <span>Password</span>
                <div className="field-row">
                  <input
                    type={show.loginPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button className="btn subtle" type="button" onClick={() => toggleShow("loginPassword")}>
                    {show.loginPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
            )}
            {mode === "register" && (
              <label className="field">
                <span>Password</span>
                <div className="field-row">
                  <input
                    type={show.registerPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder="Create password"
                    required
                  />
                  <button className="btn subtle" type="button" onClick={() => toggleShow("registerPassword")}>
                    {show.registerPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
            )}
            {mode === "change-password" && (
              <>
                <label className="field">
                  <span>Current Password</span>
                  <div className="field-row">
                    <input
                      type={show.currentPassword ? "text" : "password"}
                      value={form.currentPassword}
                      onChange={(e) => setField("currentPassword", e.target.value)}
                      placeholder="Current password"
                      required
                    />
                    <button
                      className="btn subtle"
                      type="button"
                      onClick={() => toggleShow("currentPassword")}
                    >
                      {show.currentPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <label className="field">
                  <span>New Password</span>
                  <div className="field-row">
                    <input
                      type={show.newPassword ? "text" : "password"}
                      value={form.newPassword}
                      onChange={(e) => setField("newPassword", e.target.value)}
                      placeholder="New password"
                      required
                    />
                    <button className="btn subtle" type="button" onClick={() => toggleShow("newPassword")}>
                      {show.newPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <label className="field">
                  <span>Confirm New Password</span>
                  <div className="field-row">
                    <input
                      type={show.confirmNewPassword ? "text" : "password"}
                      value={form.confirmNewPassword}
                      onChange={(e) => setField("confirmNewPassword", e.target.value)}
                      placeholder="Confirm password"
                      required
                    />
                    <button
                      className="btn subtle"
                      type="button"
                      onClick={() => toggleShow("confirmNewPassword")}
                    >
                      {show.confirmNewPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              </>
            )}
            {mode === "forgot-password" && (
              <>
                <label className="field">
                  <span>New Password</span>
                  <div className="field-row">
                    <input
                      type={show.forgotNewPassword ? "text" : "password"}
                      value={form.forgotNewPassword}
                      onChange={(e) => setField("forgotNewPassword", e.target.value)}
                      placeholder="New password"
                      required
                    />
                    <button
                      className="btn subtle"
                      type="button"
                      onClick={() => toggleShow("forgotNewPassword")}
                    >
                      {show.forgotNewPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <label className="field">
                  <span>Confirm New Password</span>
                  <div className="field-row">
                    <input
                      type={show.forgotConfirmPassword ? "text" : "password"}
                      value={form.forgotConfirmPassword}
                      onChange={(e) => setField("forgotConfirmPassword", e.target.value)}
                      placeholder="Confirm password"
                      required
                    />
                    <button
                      className="btn subtle"
                      type="button"
                      onClick={() => toggleShow("forgotConfirmPassword")}
                    >
                      {show.forgotConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              </>
            )}
            {mode === "register" && (
              <label className="field">
                <span>Role</span>
                <select value={form.role} onChange={(e) => setField("role", e.target.value)}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            )}
            {mode === "login" && (
              <button className="link-btn" type="button" onClick={() => setMode("forgot-password")}>
                Forgot Password?
              </button>
            )}
            <button className="btn glow" type="submit">
              {mode === "login"
                ? "Login"
                : mode === "register"
                  ? "Create Account"
                  : mode === "change-password"
                    ? "Change Password"
                    : "Send Forgot Password Request"}
            </button>
            {mode === "login" && (
              <div className="divider">
                <span>Or continue with</span>
              </div>
            )}
            {mode === "login" && (
              <div className="social-row" aria-hidden="true">
                <span className="social google">G</span>
                <span className="social microsoft">M</span>
              </div>
            )}
            {mode === "login" && (
              <p className="login-switch">
                Don&apos;t have an account?{" "}
                <button className="link-btn inline" type="button" onClick={() => setMode("register")}>
                  Register Now
                </button>
              </p>
            )}
            {mode === "register" && (
              <p className="login-switch">
                Already have an account?{" "}
                <button className="link-btn inline" type="button" onClick={() => setMode("login")}>
                  Login
                </button>
              </p>
            )}
            {mode === "change-password" && (
              <div className="action-row">
                <button className="btn subtle" type="button" onClick={onCheckPasswordRequestStatus}>
                  Check Admin Response
                </button>
                <button className="btn subtle" type="button" onClick={() => setMode("login")}>
                  Back to Login
                </button>
              </div>
            )}
            {mode === "forgot-password" && (
              <div className="action-row">
                <button className="btn subtle" type="button" onClick={onCheckPasswordRequestStatus}>
                  Check Admin Response
                </button>
                <button className="btn subtle" type="button" onClick={() => setMode("login")}>
                  Back to Login
                </button>
              </div>
            )}
          </form>
        </section>
      </main>
      <Toast message={toast.msg} error={toast.error} />
    </div>
  );
}

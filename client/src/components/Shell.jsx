import React from "react";
import { useAuth } from "../state/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Shell({ title, subtitle, children, onBellClick, bellCount }) {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className={`app-shell role-${role || "user"}`}>
      <header className="topbar">
        <div className="brand-wrap">
          <h1>DigiPariksha</h1>
          <p className="brand-subtitle">{subtitle}</p>
        </div>
        <div className="topbar-actions">
          {onBellClick && (
            <button className="icon-btn bell-btn" onClick={onBellClick} aria-label="Admin feedback">
              <svg className="bell-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3a5 5 0 0 0-5 5v2.4c0 .6-.2 1.2-.5 1.7l-1.2 2a1 1 0 0 0 .9 1.5h11.6a1 1 0 0 0 .9-1.5l-1.2-2a3.4 3.4 0 0 1-.5-1.7V8a5 5 0 0 0-5-5Zm0 18a2.2 2.2 0 0 0 2.1-1.6H9.9A2.2 2.2 0 0 0 12 21Z" />
              </svg>
              {Number.isInteger(bellCount) && bellCount > 0 ? (
                <span className="bell-badge">{bellCount > 9 ? "9+" : bellCount}</span>
              ) : null}
            </button>
          )}
          <span className="badge">{(role || "user").toUpperCase()}</span>
          <button
            className="btn ghost"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <main className="layout">
        <section className="card">
          <h2>{title}</h2>
          {children}
        </section>
      </main>
    </div>
  );
}

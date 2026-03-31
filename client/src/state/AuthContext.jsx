import React, { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [role, setRole] = useState(localStorage.getItem("role") || "");
  const [name, setName] = useState(localStorage.getItem("name") || "");
  const [section, setSection] = useState(localStorage.getItem("section") || "");

  const login = ({ token: nextToken, role: nextRole, name: nextName, section: nextSection }) => {
    setToken(nextToken || "");
    setRole(nextRole || "");
    setName(nextName || "");
    setSection(nextSection || "");
    localStorage.setItem("token", nextToken || "");
    localStorage.setItem("role", nextRole || "");
    localStorage.setItem("name", nextName || "");
    localStorage.setItem("section", nextSection || "");
  };

  const logout = () => {
    setToken("");
    setRole("");
    setName("");
    setSection("");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    localStorage.removeItem("section");
  };

  const value = useMemo(
    () => ({ token, role, name, section, login, logout }),
    [token, role, name, section]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

import React from "react";

export default function Toast({ message, error }) {
  if (!message) return null;
  return <div className={`toast ${error ? "error" : ""}`}>{message}</div>;
}

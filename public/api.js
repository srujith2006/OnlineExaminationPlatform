window.AppApi = (() => {
  const MAX_EXAM_ATTEMPTS = 2;
  const state = {
    token: localStorage.getItem("token") || "",
    role: localStorage.getItem("role") || "",
    name: localStorage.getItem("name") || "",
  };

  async function api(path, method = "GET", body) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  return {
    MAX_EXAM_ATTEMPTS,
    state,
    api,
  };
})();

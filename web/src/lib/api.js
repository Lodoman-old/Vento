const API = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}, isFormData = false) {
  const token = localStorage.getItem("token");
  const headers = { ...options.headers };

  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Error de servidor");

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, isFormData) => {
    const opts = { method: "POST" };
    if (!isFormData) opts.body = JSON.stringify(body);
    else opts.body = body;
    return request(path, opts, isFormData);
  },
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload: (path, formData) => request(path, { method: "POST", body: formData }, true),
};

/**
 * Cliente base para la API en Render.
 * La URL se configura en .env como VITE_API_URL
 */
const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const get    = (path)         => api(path);
export const post   = (path, body)   => api(path, { method: "POST",   body: JSON.stringify(body) });
export const put    = (path, body)   => api(path, { method: "PUT",    body: JSON.stringify(body) });
export const del    = (path)         => api(path, { method: "DELETE" });

export default api;

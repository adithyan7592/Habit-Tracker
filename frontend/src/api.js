export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`
});

export async function apiFetch(path, options = {}) {
  const headers = {
    ...authHeaders(),
    ...(options.headers || {})
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    throw new Error(data?.message || data?.error || data || "Request failed");
  }

  return data;
}

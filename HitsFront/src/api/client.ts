const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");

function normalizeToken(value: string | null) {
  if (!value) return null;
  let token = value.trim();
  if (!token) return null;
  if (token.toLowerCase().startsWith("bearer ")) token = token.slice("bearer ".length).trim();
  return token || null;
}

export async function api<T>(
  path: string,
  init: (RequestInit & { json?: unknown }) = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;

  const token = normalizeToken(localStorage.getItem("accessToken"));
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, body });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("accessToken");
      throw new Error("HTTP 401: не авторизован(а). Выполните вход заново.");
    }
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status} ${res.url}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

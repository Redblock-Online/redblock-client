let csrfReady = false;

const BASE = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") || "";

export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(";").shift() || null;
  return null;
}

export async function ensureCsrfCookie() {
  if (csrfReady) return;
  await fetch(`${BASE}/csrf-cookie`, {
    method: "GET",
    credentials: "include",
  }).catch(() => {});
  csrfReady = true;
}

type FetchOptions = RequestInit & { json?: unknown };

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${p}`;
}

export async function apiFetch(path: string, options: FetchOptions = {}): Promise<Response> {
  const url = buildUrl(path);
  const method = (options.method || "GET").toUpperCase();
  const isWrite = method !== "GET" && method !== "HEAD";

  const headers = new Headers(options.headers || {});

  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (isWrite) {
    await ensureCsrfCookie();
    const token = getCookie("XSRF-TOKEN");
    if (token) headers.set("X-XSRF-TOKEN", decodeURIComponent(token));
  }

  const body = options.json !== undefined ? JSON.stringify(options.json) : options.body;

  const res: Response = await fetch(url, {
    ...options,
    headers,
    body,
    credentials: "include",
  });
  return res;
}

export async function get(path: string, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { ...options, method: "GET" });
}
export async function post(path: string, json?: unknown, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { ...options, method: "POST", json });
}
export async function put(path: string, json?: unknown, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { ...options, method: "PUT", json });
}
export async function del(path: string, json?: unknown, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { ...options, method: "DELETE", json });
}

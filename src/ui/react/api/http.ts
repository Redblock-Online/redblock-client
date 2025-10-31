let csrfReady = false;

const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
const BASE = backendBase || "";
const TOKEN_STORAGE_KEY = "redblock.auth.token";

export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(";").shift() || null;
  return null;
}

/**
 * Get JWT token from localStorage
 */
function getJwtToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
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

/**
 * Build full URL from path
 * 
 * @param path - API path (can be relative or absolute)
 * @returns Full URL
 */
function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${p}`;
}

/**
 * Core fetch function with automatic JWT token injection and CSRF protection
 * 
 * @param path - API endpoint path
 * @param options - Fetch options including optional json body
 * @returns Response from the API
 * 
 * @remarks
 * - Automatically adds JWT token from localStorage to Authorization header
 * - Adds CSRF token for write operations (POST, PUT, DELETE)
 * - Includes credentials for cookie-based auth
 * 
 * @example
 * ```typescript
 * const response = await apiFetch('/api/users', {
 *   method: 'POST',
 *   json: { name: 'John' }
 * });
 * ```
 */
export async function apiFetch(path: string, options: FetchOptions = {}): Promise<Response> {
  const url = buildUrl(path);
  const method = (options.method || "GET").toUpperCase();
  const isWrite = method !== "GET" && method !== "HEAD";

  const headers = new Headers(options.headers || {});

  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  // Add JWT token to Authorization header if available
  const jwtToken = getJwtToken();
  if (jwtToken) {
    headers.set("Authorization", `Bearer ${jwtToken}`);
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

/**
 * Perform a GET request with automatic JWT token injection
 * 
 * @param path - API endpoint path
 * @param options - Additional fetch options
 * @returns Response from the API
 * 
 * @example
 * ```typescript
 * const response = await get('/api/users');
 * const users = await response.json();
 * ```
 */
export async function get(path: string, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { ...options, method: "GET" });
}

/**
 * Perform a POST request with automatic JWT token and CSRF protection
 * 
 * @param path - API endpoint path
 * @param json - JSON body to send
 * @param options - Additional fetch options
 * @returns Response from the API
 * 
 * @example
 * ```typescript
 * const response = await post('/api/users', { name: 'John', email: 'john@example.com' });
 * ```
 */
export async function post(path: string, json?: unknown, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { ...options, method: "POST", json });
}

/**
 * Perform a PUT request with automatic JWT token and CSRF protection
 * 
 * @param path - API endpoint path
 * @param json - JSON body to send
 * @param options - Additional fetch options
 * @returns Response from the API
 * 
 * @example
 * ```typescript
 * const response = await put('/api/users/1', { name: 'John Updated' });
 * ```
 */
export async function put(path: string, json?: unknown, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { ...options, method: "PUT", json });
}

/**
 * Perform a DELETE request with automatic JWT token and CSRF protection
 * 
 * @param path - API endpoint path
 * @param json - Optional JSON body to send
 * @param options - Additional fetch options
 * @returns Response from the API
 * 
 * @example
 * ```typescript
 * const response = await del('/api/users/1');
 * ```
 */
export async function del(path: string, json?: unknown, options: FetchOptions = {}): Promise<Response> {
  return apiFetch(path, { ...options, method: "DELETE", json });
}

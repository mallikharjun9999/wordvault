// Thin fetch wrapper. Same-origin by default (Vite proxies /api in dev). Auth is an HttpOnly cookie: JS never sees the token.
const BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method, credentials: 'include',
      headers: { 'X-WordVault-Client': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch { throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check that the backend is running.'); }
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || json?.success === false) {
    throw new ApiError(res.status, json?.error?.code || 'ERROR', json?.error?.message || `Request failed (${res.status})`, json?.error?.details);
  }
  return json;
}
export const api = {
  get: (p) => request('GET', p), post: (p, b = {}) => request('POST', p, b), put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b), del: (p) => request('DELETE', p),
  url: (p) => `${BASE}/api${p}`,
};

import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/contexts/AuthContext.jsx';

export const USER = { id: 'u1', email: 'a@example.com', displayName: 'Asha', role: 'user', preferences: { explanationLanguage: 'te', theme: 'light', timezone: 'UTC', dailyReviewLimit: 30 } };
export const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
export const okBody = (data, meta) => ({ success: true, data, ...(meta ? { meta } : {}) });
export const errBody = (code, message, status = 400) => json({ success: false, error: { code, message } }, status);

/** routes: { 'GET /path-prefix': (body, url) => Promise<Response> | data } ; calls recorded in fetch.mock.calls */
export function mockApi(routes) {
  const fn = vi.fn((url, init = {}) => {
    const path = String(url).replace(/^.*\/api/, ''); const method = init.method || 'GET';
    const key = Object.keys(routes).filter((k) => k.startsWith(`${method} `) && path.startsWith(k.slice(method.length + 1))).sort((a, b) => b.length - a.length)[0];
    if (!key) return json({ success: false, error: { code: 'NOT_FOUND', message: `unmocked ${method} ${path}` } }, 404);
    const r = routes[key]; const res = typeof r === 'function' ? r(init.body ? JSON.parse(init.body) : undefined, path) : r;
    return res && typeof res.then === 'function' ? res : json(res);
  });
  vi.stubGlobal('fetch', fn); return fn;
}
export const renderApp = (ui, { route = '/', user = USER } = {}) => {
  return render(<MemoryRouter initialEntries={[route]}><AuthProvider>{ui}</AuthProvider></MemoryRouter>);
};
export const withMe = (routes, user = USER) => ({ 'GET /auth/me': okBody({ user }), ...routes });

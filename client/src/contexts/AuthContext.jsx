import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function applyTheme(pref) {
  const dark = pref === 'dark' || (pref !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', !!dark);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setUser((await api.get('/auth/me')).data.user); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { applyTheme(user?.preferences?.theme || 'system'); }, [user?.preferences?.theme]);

  const value = useMemo(() => ({
    user, loading, refresh,
    async login(email, password) { const r = await api.post('/auth/login', { email, password }); setUser(r.data.user); },
    async register(payload) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await api.post('/auth/register', { ...payload, timezone }); setUser(r.data.user);
    },
    async logout() { await api.post('/auth/logout'); setUser(null); },
    async updateProfile(patch) { const r = await api.patch('/auth/me', patch); setUser(r.data.user); return r.data.user; },
    clear() { setUser(null); },
  }), [user, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

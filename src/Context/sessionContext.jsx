// src/Context/sessionContext.jsx
//
// Session state for SolSkies. Backed by:
//   - JWT (in localStorage via src/lib/api.js — also in module-local state for fetch)
//   - cached user object (localStorage `solskies_session`)
//
// On mount:
//   1. If a token is present, call GET /api/auth/me to validate it.
//      - 200 → set user, refresh cache.
//      - 401 → clear everything.
//   2. If no token, render anonymous (loading: false, user: null).
//
// login() expects the {user, token} response from the server. The token is
// persisted via setAuthToken(); user goes into both state + localStorage cache
// (the cache is purely a UX optimization to avoid the /me round-trip flicker).

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, setAuthToken, getAuthToken, setUnauthorizedHandler } from '../lib/api';

const SessionContext = createContext();
const USER_KEY = 'solskies_session';

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Mount: validate cached token ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const token = getAuthToken();

      // Optimistic restore from cache so the UI doesn't flash unauth'd.
      try {
        const raw = localStorage.getItem(USER_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.user) setUser(cached.user);
        }
      } catch { /* ignore */ }

      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const { user: fresh } = await apiFetch('/api/auth/me');
        if (cancelled) return;
        setUser(fresh);
        localStorage.setItem(USER_KEY, JSON.stringify({ user: fresh }));
      } catch {
        // Token expired/invalid — apiFetch already cleared it.
        if (cancelled) return;
        setUser(null);
        localStorage.removeItem(USER_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  // Register a 401-handler so any apiFetch caller that hits an expired token
  // immediately drops the user from React state without waiting for re-mount.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      try { localStorage.removeItem(USER_KEY); } catch {}
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // ── login: called by Login.jsx / SignUp.jsx with the server's response ────
  const login = useCallback((userData, token) => {
    setAuthToken(token);
    setUser(userData);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify({ user: userData }));
    } catch { /* ignore */ }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // logout: hard-redirect to /?loggedOut=1 — see lengthy comment below.
  // The flag tells Home to skip the wallet auto-login this paint.
  // ─────────────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    setAuthToken(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}

    try {
      if (window.solana?.disconnect) await window.solana.disconnect();
    } catch { /* non-fatal */ }

    setUser(null);
    window.location.replace('/?loggedOut=1');
  }, []);

  // clearSession: like logout but no redirect. Used on wallet-switch.
  const clearSession = useCallback(() => {
    setAuthToken(null);
    try { localStorage.removeItem(USER_KEY); } catch {}
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  return (
    <SessionContext.Provider value={{ user, loading, isAuthenticated, login, logout, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
};

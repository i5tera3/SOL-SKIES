// src/lib/api.js
// Centralized API base + fetch helper + JWT auth.
//
// Usage:
//   import { API_BASE, apiFetch, setAuthToken, getAuthToken } from '../lib/api';
//
//   await apiFetch('/api/missions', { method: 'POST', body: JSON.stringify(data) });
//
// Set VITE_API_URL in .env to override (e.g. for staging/production).

// API_BASE resolution order:
//  1. Explicit VITE_API_URL (env var at build time — set this if frontend and
//     backend are on different domains).
//  2. Same-origin '' when running on a non-localhost host (Railway/Vercel/etc.
//     where Express serves the built frontend on the same domain → relative
//     /api paths Just Work).
//  3. Localhost dev fallback: http://localhost:3001 (Vite dev → Express dev).
function resolveApiBase() {
  const explicit = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h && h !== 'localhost' && h !== '127.0.0.1') return ''; // same-origin
  }
  return 'http://localhost:3001';
}
export const API_BASE = resolveApiBase();

const TOKEN_KEY = 'solskies_token';

// Token is held both in module-local state (synchronous read on every fetch)
// and in localStorage (survives reloads).
let _token = null;
try { _token = localStorage.getItem(TOKEN_KEY); } catch { /* SSR / private mode */ }

// ─── Global fetch interceptor ─────────────────────────────────────────────────
// Every fetch() targeting our API_BASE automatically gets `Authorization: Bearer
// <jwt>` if a token is set and the caller didn't supply one. This avoids having
// to refactor every existing fetch() in the dashboards (50+ call sites) to use
// apiFetch — the JWT just rides along.
//
// This is safe because:
//   - We only inject for URLs starting with API_BASE (own server).
//   - We never overwrite an Authorization header the caller already set.
//   - Server endpoints that don't require auth simply ignore the header.
if (typeof globalThis !== 'undefined' && globalThis.fetch && !globalThis.__solskies_fetch_patched) {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = function patchedFetch(input, init = {}) {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      // Attach JWT only to OUR API:
      //   - URLs starting with API_BASE (the absolute form in dev)
      //   - relative URLs starting with /api or /uploads (same-origin in prod)
      // Never leak the bearer to third parties (OpenWeatherMap, NASA, etc.).
      const isOurApi =
        (API_BASE && url.startsWith(API_BASE)) ||
        (url.startsWith('/api/') || url.startsWith('/uploads/'));
      if (_token && isOurApi) {
        const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${_token}`);
        }
        init = { ...init, headers };
      }
    } catch { /* on any failure, fall through to plain fetch */ }
    return originalFetch(input, init);
  };
  globalThis.__solskies_fetch_patched = true;
}

export function setAuthToken(token) {
  _token = token || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

export function getAuthToken() {
  return _token;
}

// Optional global hook — sessionContext registers a callback so it can clear
// React state immediately when a 401 lands on any apiFetch call.
let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn;
}

// Lightweight fetch wrapper — JSON in, JSON out, throws on non-2xx.
// Pass `raw: true` to bypass JSON parsing (returns the Response).
// Pass `skipAuth: true` to omit the Authorization header (e.g. login flow).
export async function apiFetch(path, options = {}) {
  const { raw, skipAuth, headers, body, ...rest } = options;
  const isFormData = body instanceof FormData;

  const finalHeaders = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(!skipAuth && _token ? { Authorization: `Bearer ${_token}` } : {}),
    ...(headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body,
  });

  // Auto-clear on token rejection so the UI can react on the next render.
  if (res.status === 401 && _token) {
    setAuthToken(null);
    if (_onUnauthorized) _onUnauthorized();
  }

  if (raw) return res;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Auth-flow helpers ────────────────────────────────────────────────────────
// Implements: POST /wallet-challenge → wallet.signMessage → POST /wallet-login.
// Caller provides a `signFn(messageBytes) => Promise<Uint8Array>` adapter; for
// @solana/wallet-adapter-react this is just `signMessage`.
import bs58 from 'bs58';

export async function signInWithWallet(walletAddress, signFn) {
  // 1. Get the challenge.
  const challenge = await apiFetch('/api/auth/wallet-challenge', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ walletAddress }),
  });

  // 2. Sign the message bytes.
  const messageBytes = new TextEncoder().encode(challenge.message);
  const signatureBytes = await signFn(messageBytes);
  const signature = bs58.encode(signatureBytes);

  // 3. Submit the proof.
  const result = await apiFetch('/api/auth/wallet-login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ walletAddress, signature, nonce: challenge.nonce }),
  });

  // 4. Persist the issued token.
  setAuthToken(result.token);
  return result;
}

// Same flow but for signup — caller posts the form data themselves.
// Returns { signature, nonce } that they should include in the POST body.
export async function getSignupProof(walletAddress, signFn) {
  const challenge = await apiFetch('/api/auth/wallet-challenge', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ walletAddress }),
  });
  const messageBytes = new TextEncoder().encode(challenge.message);
  const signatureBytes = await signFn(messageBytes);
  const signature = bs58.encode(signatureBytes);
  return { signature, nonce: challenge.nonce };
}

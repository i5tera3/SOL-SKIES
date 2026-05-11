// server/auth.mjs
// Wallet-signature challenge/response + JWT issuance.
//
// Flow:
//   1. Client POSTs /api/auth/wallet-challenge → server returns { nonce, message }.
//      Server stores (walletAddress → nonce) with a 5-minute TTL.
//   2. Client asks the wallet to signMessage(message). Wallet returns 64-byte signature.
//   3. Client POSTs /api/auth/wallet-login (or signup endpoint) with
//      { walletAddress, signature (base58), nonce }.
//   4. Server: looks up the active nonce, verifies signature with nacl, consumes the
//      nonce (single-use), issues a 7-day JWT signed with JWT_SECRET.
//   5. Every subsequent request carries `Authorization: Bearer <jwt>`.
//      requireAuth middleware decodes + validates, attaches req.user.
//
// SECURITY NOTES:
//   - Nonces are single-use and time-bound — replay-resistant.
//   - JWT_SECRET MUST be set in production. A random ephemeral fallback is used
//     only for first-boot dev convenience and invalidates all tokens on restart.
//   - The nonce store is in-memory; if you scale beyond one process, swap for Redis.

import nacl from 'tweetnacl';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const STATEMENT = 'Sign this message to authenticate with Sol Skies.\n\nNonce: ';
const NONCE_TTL_MS = 5 * 60 * 1000;
const JWT_TTL = '7d';

const ENV_SECRET = process.env.JWT_SECRET;
const PLACEHOLDER = 'replace-me-with-32-bytes-of-randomness';
let SIGNING_KEY;
if (ENV_SECRET && ENV_SECRET !== PLACEHOLDER && ENV_SECRET.length >= 32) {
  SIGNING_KEY = ENV_SECRET;
} else {
  SIGNING_KEY = randomBytes(32).toString('hex');
  console.warn(
    '[auth] JWT_SECRET unset or placeholder — using an EPHEMERAL dev secret.\n' +
    '       All issued tokens will become invalid on server restart.\n' +
    '       Generate a proper secret with:\n' +
    '         node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
    '       and put it in .env as JWT_SECRET=…'
  );
}

// ─── Nonce store: walletAddress → { nonce, expiresAt } ───────────────────────
const nonces = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of nonces) if (v.expiresAt < now) nonces.delete(k);
}, 60 * 1000).unref();

// ─── Public helpers ───────────────────────────────────────────────────────────
export function generateChallenge(walletAddress) {
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = Date.now() + NONCE_TTL_MS;
  nonces.set(walletAddress, { nonce, expiresAt });
  const message = `${STATEMENT}${nonce}`;
  return { nonce, statement: STATEMENT, message, expiresAt };
}

export function verifyChallenge(walletAddress, signatureB58, nonce) {
  const stored = nonces.get(walletAddress);
  if (!stored) return { ok: false, reason: 'No active challenge for this wallet — request a fresh nonce' };
  if (stored.expiresAt < Date.now()) {
    nonces.delete(walletAddress);
    return { ok: false, reason: 'Challenge expired' };
  }
  if (stored.nonce !== nonce) return { ok: false, reason: 'Nonce mismatch' };

  let signatureBytes, pubkeyBytes;
  try {
    signatureBytes = bs58.decode(signatureB58);
    pubkeyBytes = bs58.decode(walletAddress);
  } catch {
    return { ok: false, reason: 'Malformed signature or wallet address' };
  }
  if (signatureBytes.length !== 64) return { ok: false, reason: 'Signature must be 64 bytes' };
  if (pubkeyBytes.length !== 32) return { ok: false, reason: 'Public key must be 32 bytes' };

  const message = new TextEncoder().encode(`${STATEMENT}${nonce}`);
  const valid = nacl.sign.detached.verify(message, signatureBytes, pubkeyBytes);
  if (!valid) return { ok: false, reason: 'Signature verification failed' };

  nonces.delete(walletAddress); // single-use
  return { ok: true };
}

export function signToken(payload) {
  return jwt.sign(payload, SIGNING_KEY, { expiresIn: JWT_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SIGNING_KEY);
  } catch {
    return null;
  }
}

// ─── Express middleware ───────────────────────────────────────────────────────
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authorization header missing' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = payload;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// Attach req.user if a valid token is present, but do not reject if absent.
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}

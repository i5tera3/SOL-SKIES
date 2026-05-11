# SOL-SKIES

Decentralized coordination and trust infrastructure for distributed drone operations.
Built for the Eternal Colosseum Hackathon.

## What it is

A two-sided platform that lets enterprises source, verify, fund, and coordinate
independent drone operators at scale, with on-chain escrow + reputation primitives
on Solana devnet.

- **Enterprises** post missions (inspections, mapping, surveys) and fund them in SOL.
- **Operators** register drone hardware/firmware/certifications, apply to missions,
  and get paid from escrow on completion.
- **Multi-operator coordination**: one mission can be split across multiple operators
  via subtask claiming.

## Stack

- Frontend: React 19 + Vite 6 + react-router-dom 7
- Wallet: `@solana/wallet-adapter-react` (Phantom, Solflare, Torus) on devnet
- Backend: Node 20 + Express + JSON-file DB (SQLite migration in progress)
- On-chain: `@solana/web3.js` for SOL transfers; Anchor escrow program planned

## Quick start

```bash
npm install
cp .env.example .env       # edit with your values
npm run dev:all            # runs server (3001) + frontend (5173)
```

## Repo layout

```
src/
  app/         routes (Home, Login, SignUp, dashboards, profiles)
  components/  Reusable UI (HealthGauge, ProtectedRoute, MapView, etc.)
  Context/     React contexts (Wallet, Session)
  lib/         api.js — centralized fetch helper
  utils/       SigninMessage (nacl signature helper)
server/
  index.mjs       Express entrypoint
  simple-db.mjs   JSON-file DB (current)
  database.mjs    SQLite DB (in-progress migration)
  escrow.mjs      Devnet escrow keypair + helpers
  uploads/        multer disk storage (gitignored)
```

## Environment

See `.env.example`. Required:

- `VITE_API_URL` — frontend points at this for API calls
- `WEATHER_API_KEY` — OpenWeatherMap (mock data if absent)
- `ESCROW_SECRET_KEY` — devnet keypair JSON array; auto-generated if unset

# SolSkies — Setup & Run Instructions

Step-by-step for getting SolSkies running locally, deploying it, and demoing it.

---

## 1. Prerequisites

| Tool | Version | Why |
|---|---|---|
| **Node.js** | **20 LTS** (NOT 22, NOT 24) | `better-sqlite3` ships prebuilt binaries for Node 20. Node 22+ may force native compile and require MSVC build tools on Windows. |
| **npm** | 10+ | Comes with Node 20. |
| **Git** | any recent | For cloning the repo. |
| **A Solana wallet** | Phantom / Solflare | For signup + signing the wallet challenge. |

**Windows users:** install `nvm-windows` to switch Node versions easily — https://github.com/coreybutler/nvm-windows/releases

```powershell
nvm install 20.18.0
nvm use 20.18.0
```

---

## 2. Clone and install

```bash
git clone https://github.com/i5tera3/SOL-SKIES.git
cd SOL-SKIES
npm install
```

The install takes ~5–8 minutes the first time because `better-sqlite3` needs to fetch a prebuilt native binary.

If install fails with `gyp ERR!`, you're not on Node 20. Run `nvm use 20.18.0` and retry. If you don't have nvm, install Node 20 LTS from https://nodejs.org/

---

## 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

### Required

```bash
# Sign tokens with a real secret — without this, every server restart invalidates all sessions.
# Generate one with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<paste 64-char hex here>
```

### Optional

```bash
# OpenWeatherMap API key (free tier).
# Without this, the weather + flyability endpoints return deterministic mock data — still works for the demo.
WEATHER_API_KEY=

# Persistent escrow keypair. If unset, the server generates a fresh one on first boot
# and persists it to server/.escrow-keypair.json (gitignored).
ESCROW_SECRET_KEY=

# CORS allow-list. Comma-separated. Required in production; ignored in dev (wide-open).
FRONTEND_URL=http://localhost:5173

# Port for the Express server. Defaults to 3001 if unset.
PORT=3001
```

---

## 4. Run locally

```bash
npm run dev:all
```

This starts two processes concurrently:

- **Express server** on http://localhost:3001 — API + escrow + uploads
- **Vite dev server** on http://localhost:5173 — frontend with HMR

Open http://localhost:5173 in your browser.

### First-boot behavior

On the first server start, you'll see:

```
[db] solskies.db is empty and db.json exists — migrating…
[db] Migration complete. db.json renamed to db.json.bak.
[db]   operators=N, enterprises=N, missions=N, contracts=N
[auth] JWT_SECRET unset or placeholder — using an EPHEMERAL dev secret.   (if you skipped JWT_SECRET setup)
✅ Escrow module loaded. Address: <some-base58-address> (devnet)
🚀 Sol Skies server running on http://localhost:3001
```

If `JWT_SECRET` is unset, sessions die on every restart. Fine for first-run smoke tests, painful for actual demos. Set it.

---

## 5. Seed the demo data

Navigate to http://localhost:5173/admin and click the **"Reset & seed demo"** button.

This populates:
- 3 operators (Alex Hartmann/Germany/expert, Zara Khalil/Jordan/advanced, Jordan Riley/US/intermediate) with realistic work history timelines and certifications
- 2 enterprises (Skybuild Energy/Germany, Pipeflow MENA/UAE) with industry + region metadata
- 3 missions:
  - **Completed:** Hamburg storage thermal inspection (1 operator, rated 5★)
  - **Open multi-op:** Cross-border pipeline survey Jordan→UAE (4 slots, 1 claimed by Zara with stake locked)
  - **Active:** North Sea wind farm cable inspection (1 operator, in-progress subtasks)
- Audit trail entries for each major action

You only need to seed once unless you click the button again — the data persists in `server/solskies.db`.

---

## 6. Demo walkthrough

### As an enterprise

1. http://localhost:5173/signup → pick "Enterprise" → fill the form
2. Connect Phantom (devnet) → sign the auth challenge
3. You land on the **Dashboard** tab — wallet balance, stat cards, "+ Create Mission" button
4. Click **"🔎 Find Operators"** in the sidebar → filter by region/cert/vehicle/rating → click Alex's card
5. On Alex's profile: see his reputation score breakdown, work-history timeline, drone fleet, stats
6. Click **"💬 Message"** on Alex's profile → write a message → Send → you're routed back to your dashboard's Messages tab with the new thread visible
7. Click **"+ Create Mission"** → fill the form → submit (server deducts your balance, mission goes live)
8. Visit `/missions/<id>` → check the slot grid, audit timeline, mission risk, airspace, weather

### As an operator

1. Sign in as Alex by visiting `/login`, connecting his wallet (or sign up fresh with a different wallet)
2. **Dashboard** tab — profile card, earnings, drone specs, active contracts
3. **Contracts** tab — filter contracts, browse open missions, apply or claim subtasks
4. **Weather** tab — geolocate, view forecasts + NASA EONET hazards within a radius
5. **Messages** tab — see threads from enterprises who messaged you

### Disputes

On any active contract, click **"⚠ Raise dispute"** from either side. Provide a reason + optional evidence URL. The mission transitions to `disputed`. An admin can resolve via `POST /api/admin/disputes/:id/resolve` (currently curl-only; admin UI is post-submission roadmap).

---

## 7. Commands reference

| Command | What it does |
|---|---|
| `npm run dev:all` | Start server + frontend in parallel (the usual dev command) |
| `npm run dev` | Start Vite frontend only (port 5173) |
| `npm run server` | Start Express server only (port 3001) |
| `npm run build` | Build the frontend to `dist/` for production |
| `npm start` | Run the Express server (used in production) |

---

## 8. Project structure (high level)

```
server/             Express backend, SQLite, escrow, schemas, FSM, etc.
src/                React frontend
  Context/          Wallet + Session providers
  components/       Shared UI components
  lib/api.js        JWT-aware fetch helper
  pages/            Routes
.env.example        Template for environment variables
package.json        Scripts + dependencies
```

See `README.md` for the full file-by-file map.

---

## 9. Deploying to production

The deployed instance lives at **https://sol-skies-production.up.railway.app**.

Stack: Node 20 LTS + Express + SQLite, deployed as a single service on Railway.

### Deploying your own copy on Railway

1. Push your repo to GitHub
2. https://railway.app → New Project → Deploy from GitHub repo → pick your fork
3. Wait ~4 minutes for the first build (`npm install` → `npm run build` → `npm start`)
4. **Variables** tab:
   - `JWT_SECRET` — paste a generated hex string
   - `FRONTEND_URL` — `https://<your-app>.up.railway.app` (locks CORS to that origin)
   - `ESCROW_SECRET_KEY` — optional; auto-generated and persisted if unset
5. **Settings** tab → **Volumes** → mount `/app/server` → 1 GB (so SQLite and uploads survive redeploys)
6. **Settings** → **Networking** → **Generate Domain** → copy the URL → that's your public link

### Important Railway notes

- `vite` and `@vitejs/plugin-react` are in `dependencies` (not `devDependencies`) so Railway installs them in production
- `package.json` `"build"` script uses `node ./node_modules/vite/bin/vite.js build` directly to avoid Linux executable-bit issues
- The Express server serves the built frontend from `dist/` in production, so one URL hosts both API and frontend
- Frontend's `API_BASE` auto-resolves to same-origin (empty string) when not on localhost — no `VITE_API_URL` env var needed in production

### Alternatives

- **Render.com** — same flow as Railway. Free tier sleeps after 15 min of inactivity.
- **Fly.io** — requires CLI install, otherwise similar.
- **Vercel alone won't work** — serverless functions can't host the stateful Express server or SQLite. If you want Vercel for the frontend, you still need a separate backend host.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `gyp ERR!` during `npm install` | Node 22+ without MSVC build tools | `nvm use 20.18.0`, delete `node_modules` + `package-lock.json`, retry |
| `Could not locate the bindings file` (better-sqlite3) | Same as above | Same fix |
| `require() of ES Module ... uuid ... not supported` | rpc-websockets ↔ uuid version mismatch | The `package.json` already has `"overrides": { "rpc-websockets": { "uuid": "^9.0.0" } }`. Delete `node_modules` + `package-lock.json`, retry `npm install`. |
| `vite: Permission denied` on Railway | Linux executable bit not set on installed binary | Already worked around — build script uses `node ./node_modules/vite/bin/vite.js build` |
| `Failed to create mission` | Schema validation failure | Look at the toast / browser-console error message — it tells you the exact field. The schema is permissive but logs structured zod errors. |
| Chat messages don't appear | Two messaging systems (legacy contract messages + Phase-2 conversations) — both now unified | Should work post-fix; if not, check that both `/api/messages/:contract` and `/api/conversations/:id/messages` are reachable |
| `Failed to fetch` in browser | Server isn't running, or wrong port | Check the server terminal. Ensure `npm run server` says "🚀 Sol Skies server running" |
| Admin page shows "Missions (0)" but missions exist | `/api/debug/db` legacy endpoint read the old JSON file | Cosmetic only — public APIs return correct data. Fix applied; redeploy if your fork doesn't have it. |

---

## 11. API surface (key endpoints)

Auth (public):
- `POST /api/auth/wallet-challenge` — issue a one-time nonce for a wallet
- `POST /api/auth/wallet-login` — verify signature + nonce, return JWT
- `GET /api/auth/me` (auth) — return the authed user
- `GET /api/auth/wallet-check` — does a wallet have an account?

Profiles (mostly public):
- `GET /api/operators/:id` — full operator record
- `GET /api/profiles/operator/username/:username` — public-shape lookup
- `GET /api/operators/:id/experiences` — work history
- `POST /api/operators/:id/experiences` (auth, owner) — add a row
- `GET /api/operators/:id/reputation` — score breakdown

Marketplace search (public):
- `GET /api/search/operators?region=&cert=&vehicle_type=&min_rating=&min_hours=&license_status=`
- `GET /api/search/enterprises?industry=&region=&verified=`

Missions:
- `GET /api/missions` — public listing with filters
- `POST /api/missions` (auth, enterprise) — create mission; auto-creates slots if `required_operators > 1`
- `GET /api/missions/:id/slots` — slot status grid
- `POST /api/missions/:id/slots/:slotId/claim` (auth, operator) — eligibility-gated
- `GET /api/missions/:id/eligibility` (auth, operator) — check qualification
- `GET /api/missions/:id/risk` — risk score
- `GET /api/missions/:id/audit` — event timeline
- `POST /api/missions/:id/transition` (auth) — FSM-validated state change

Contracts + escrow:
- `POST /api/contracts/:id/complete` (auth, enterprise) — rate operator + release stake
- `POST /api/contracts/:id/release-payment` (auth, enterprise) — pay from escrow
- `POST /api/contracts/:id/dispute` (auth, either party) — raise dispute
- `POST /api/escrow/verify-deposit` (auth, enterprise) — verify on-chain deposit

Compliance + environment (public):
- `GET /api/airspace/check?lat=&lng=` — LAANC mock authorization
- `GET /api/weather?lat=&lng=` — flyability forecast
- `GET /api/eonet?lat=&lng=&radius=` — NASA hazard proximity

Demo:
- `POST /api/admin/seed-demo` — wipe + populate demo dataset

---

## 12. Roadmap (post-hackathon)

- **Anchor escrow program** — replace the server-held devnet keypair with a PDA-based on-chain escrow + multi-sig release
- **Reputation NFTs** — mint soulbound badges on mission completion, signed by the rating enterprise
- **ULog hash anchoring** — operators submit PX4 / ArduPilot flight logs; hash committed on-chain at completion for tamper-proof inspection records
- **Real LAANC integration** — swap the mock for the FAA's actual LAANC API once authorization is obtained
- **Mobile** — native or PWA experience for field operators
- **Admin disputes UI** — verdict buttons instead of curl
- **Playwright smoke tests** — signup, post-mission, complete-and-pay flows

---

## Support

Open an issue on GitHub: https://github.com/i5tera3/SOL-SKIES/issues

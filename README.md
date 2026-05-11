# SolSkies

**Decentralized coordination and trust infrastructure for distributed drone operations on Solana.**

> Live demo: https://sol-skies-production.up.railway.app
> Repository: https://github.com/i5tera3/SOL-SKIES

---

## What it is

SolSkies is a two-sided marketplace + trust layer connecting:

- **Enterprises** — post missions (pipeline inspection, mapping, photogrammetry, deliveries), fund them with SOL escrowed on-chain, source from a global operator pool with verified capabilities
- **Drone operators** — register hardware/firmware/certifications, build a LinkedIn-style work-history, apply or claim mission slots, get paid instantly on completion

It is not just a job board. The defensible product is the trust + coordination layer underneath: wallet-signature identity, on-chain reputation scoring, multi-operator slot orchestration with staking, LAANC-style airspace pre-checks, dispute resolution with stake slashing, and append-only audit trails.

---

## Feature highlights

| Area | What's built |
|---|---|
| **Auth** | Wallet-signature challenge/response (nacl Ed25519), JWT sessions (7-day), role-based middleware on every protected endpoint, replay-resistant single-use nonces |
| **Mission lifecycle** | 10-state finite-state machine: `draft → funded → open → partially_filled → fully_staffed → active → submitted → completed`, plus `disputed` / `cancelled` terminal states. Transitions are role-gated. |
| **Multi-operator missions** | Slot-based model: missions can require N operators, each slot with its own requirements; operators claim slots, optionally lock SOL stake; mission auto-transitions as slots fill |
| **Eligibility engine** | Given an operator profile and mission requirements, returns `{eligible, missingRequirements[], score}`. Checks certifications, min flight hours, vehicle type, payload capability, license status. |
| **Reputation** | Live 0–100 score derived from average rating × completed missions × flight hours × certifications × verified license, with slash penalty for failed stakes |
| **Mission risk score** | Per-mission risk assessment (low/medium/high) from funding state, staffing fill rate, operator reputation average, complexity, requirement stringency |
| **Disputes** | Either party raises dispute with reason + evidence; admin verdict drives stake fate (release / slash) and parent mission terminal state |
| **Audit trail** | Append-only event log per mission and per contract, surfaced as a vertical timeline UI |
| **Work history** | LinkedIn-style timeline on operator profile — company, role, region, industry, drone models, optional photo, dates, description. Company name autocompletes against registered enterprises. |
| **Marketplace search** | Enterprises browse operators by region, certification, vehicle type, minimum rating, minimum hours, license status. Results enriched with live reputation scores. |
| **In-app messaging** | Unified chat — legacy per-contract messages AND Phase-2 conversation threads. "Message operator" CTA from profile pages creates threads before any contract exists. |
| **Compliance** | LAANC-style airspace authorization mock per mission (returns cleared / caution / restricted with NOTAMs, airspace class, max altitude) |
| **Weather + hazards** | OpenWeatherMap current + 7-day flyability forecasts; NASA EONET active natural-hazard proximity feed with haversine distance filtering |
| **Demo seed** | One-click admin button wipes the DB and populates 3 operators (with work history + photos), 2 enterprises, 3 missions including a 4-slot multi-operator mission with 1 claimed |

---

## Architecture

```
┌────────────────────────────────────────────────┐
│  React 19 + Vite 6 (single-page app)            │
│  ├─ Routes: Home, Login, SignUp, Operator/      │
│  │  Enterprise dashboards (tab-decomposed),     │
│  │  Operator/Enterprise profiles, MissionDetails │
│  ├─ Wallet: Phantom / Solflare / Torus adapters │
│  ├─ Toasts: react-hot-toast                     │
│  └─ Shared components: SlotGrid, RiskBadge,     │
│     AuditTimeline, EligibilityBadge,            │
│     ReputationCard, AirspaceBadge, etc.         │
└────────────────────────────────────────────────┘
                       │
            HTTPS · JWT-authenticated
                       │
┌────────────────────────────────────────────────┐
│  Express 4 server (Node 20)                     │
│  ├─ auth.mjs        – nonce store, JWT, middleware │
│  ├─ schemas.mjs     – zod validation on every endpoint │
│  ├─ missionFSM.mjs  – mission lifecycle state machine │
│  ├─ eligibility.mjs – capability matcher        │
│  ├─ reputation.mjs  – score derivation          │
│  ├─ database.mjs    – SQLite (better-sqlite3,   │
│  │  WAL, FK on) with auto-migration from JSON   │
│  ├─ escrow.mjs      – devnet SOL escrow helpers │
│  ├─ seed.mjs        – demo dataset seeder       │
│  └─ index.mjs       – routes + serves built     │
│     frontend from /app/dist in production       │
└────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌──────────────┐
│ Solana      │ │ OpenWeather │ │ NASA EONET   │
│ devnet      │ │ (forecasts) │ │ (hazards)    │
│ (escrow +   │ │             │ │              │
│ wallet sig) │ │             │ │              │
└─────────────┘ └─────────────┘ └──────────────┘
```

---

## Project layout

```
.
├── server/
│   ├── auth.mjs              JWT + wallet challenge/verify
│   ├── database.mjs          SQLite schema + helpers + auto-migration
│   ├── eligibility.mjs       Operator ↔ mission capability matcher
│   ├── escrow.mjs            Devnet SOL escrow (server-held keypair)
│   ├── index.mjs             Express routes + static SPA fallback
│   ├── missionFSM.mjs        Mission lifecycle state machine
│   ├── reputation.mjs        Score + mission risk computation
│   ├── schemas.mjs           zod schemas (every endpoint)
│   ├── seed.mjs              Demo dataset
│   ├── simple-db.mjs         Legacy JSON store (kept for fallback)
│   ├── solskies.db           SQLite database (gitignored)
│   └── uploads/              Multer disk storage (gitignored)
├── src/
│   ├── App.jsx               Routes + global Toaster
│   ├── main.jsx              React 19 root
│   ├── Context/
│   │   ├── WalletContext.jsx
│   │   └── sessionContext.jsx  JWT-aware session
│   ├── components/
│   │   ├── AirspaceBadge.jsx
│   │   ├── AuditTimeline.jsx
│   │   ├── BioEditor.jsx
│   │   ├── ContactOperatorButton.jsx
│   │   ├── DemoResetButton.jsx
│   │   ├── DisputeModal.jsx
│   │   ├── EligibilityBadge.jsx
│   │   ├── ExperienceModal.jsx
│   │   ├── ExperienceTimeline.jsx
│   │   ├── MissionStatePill.jsx
│   │   ├── ReputationCard.jsx
│   │   ├── RiskBadge.jsx
│   │   ├── SlotGrid.jsx
│   │   └── WeatherBadge.jsx
│   ├── lib/
│   │   └── api.js            apiFetch + JWT interceptor + signInWithWallet
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── SignUp.jsx
│   │   ├── Admin.jsx
│   │   ├── EnterpriseDashboard.jsx
│   │   ├── EnterpriseProfile.jsx
│   │   ├── MissionDetails.jsx
│   │   ├── OperatorProfile.jsx
│   │   ├── enterprise/tabs/      DashboardTab / MissionsTab / HistoryTab / FindOperatorsTab
│   │   └── operator/
│   │       ├── dashboard.jsx
│   │       └── tabs/             DashboardTab / ContractsTab / WeatherTab / ContactTab
│   └── utils/
│       └── SigninMessage.js  (legacy – signature flow moved to api.js)
├── public/
├── .env.example
├── .gitignore
├── package.json
├── vite.config.js
└── README.md (this file)
```

---

## Tech stack

| Layer | Tech |
|---|---|
| **Blockchain** | Solana devnet, `@solana/web3.js`, Phantom + Solflare + Torus wallet adapters, `tweetnacl` for Ed25519 signature verification, base58 encoding via `bs58` |
| **Frontend** | React 19, Vite 6, React Router 7, `react-hot-toast` |
| **Backend** | Node 20 LTS, Express 4, `better-sqlite3`, `jsonwebtoken`, `zod`, `multer`, `cors`, `dotenv` |
| **Storage** | SQLite (single-file, WAL journaling, foreign keys enforced), local filesystem for uploads |
| **External APIs** | OpenWeatherMap (current + 5-day forecast), NASA EONET v3 (open natural-event tracker) |
| **Hosting** | Railway (Node service + persistent volume), GitHub (source) |
| **Dev tools** | Vite HMR, `concurrently` for joint dev script, `node --check` for syntax verification |
| **AI / pair-programming** | Claude Code (Anthropic) — used extensively for architecture design, security review, and frontend decomposition |

---

## Live demo flow

1. Visit https://sol-skies-production.up.railway.app
2. Hit `/admin` → click **Reset & seed demo** (one-time, populates Alex/Zara/Jordan + 3 missions)
3. **Browse missions** — homepage and `/missions/:id` pages show the full Phase-4 UI: slot grid, eligibility badges, audit timeline, weather, LAANC airspace, NASA hazards
4. **Sign up as a new enterprise** with your Phantom wallet → sign the auth challenge → create a mission → fund the escrow
5. Sign in as an operator (or sign up fresh) → "🔎 Find Operators" tab as enterprise to browse the talent pool
6. Click "💬 Message" on Alex's profile (as enterprise) → start a thread that appears in your dashboard's Messages tab
7. Raise a dispute on an active contract from either dashboard → admin verdict drives stake slash/release

---

## Security model

- **Wallet auth:** Server-side nacl signature verification against a single-use, time-bound nonce. JWT issued only after verification.
- **Authorization:** Role-based middleware on every protected endpoint; ownership checks on per-row mutations (operators can only edit their own profile, enterprises can only update their own missions, etc.).
- **Input validation:** Every endpoint runs request bodies through a zod schema before the handler executes.
- **Field stripping:** Sensitive fields (`wallet_address`, `role`, `total_earned`, `usdc_balance`) cannot be patched even by the owner.
- **Cross-user enumeration:** Filter parameters on listing endpoints are derived from JWT, not from query string, so a user can only list their own contracts/conversations.
- **Stake bookkeeping:** Stake state lives in `operator_stakes` table; release/slash are atomic SQL transactions. On-chain Anchor escrow program is planned for Phase 5.
- **CORS:** Locked to `FRONTEND_URL` env var in production; wide-open in dev.

---

## Known limitations (honest)

- **Custodial escrow** — the server holds a devnet keypair. This is fine for the hackathon demo but unacceptable for mainnet. Phase 5 plans an Anchor PDA escrow program with multi-sig release.
- **Single-process nonce store** — replay protection is in-memory only; would need Redis to scale beyond one server instance.
- **Demo seed is destructive** — the admin button wipes everything and reseeds. Production would gate this behind admin-role auth.
- **LAANC is mocked** — the airspace authorization endpoint returns deterministic mock data. Real LAANC integration requires FAA authorization.
- **Mobile** — responsive but desktop/tablet-first. A native or PWA experience for field operators is a roadmap item.

---

## Quick start (local development)

See [`INSTRUCTIONS.md`](./INSTRUCTIONS.md) for the detailed setup walkthrough.

```bash
# Prerequisites: Node 20 LTS
npm install
cp .env.example .env
# Generate a JWT secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste into .env as JWT_SECRET=...

npm run dev:all          # starts both server (3001) and Vite (5173)
```

Then visit http://localhost:5173 and click **Reset & seed demo** in the admin page.

---

## License

MIT. See [LICENSE](./LICENSE).

---

## Credits

Built for the Eternal Colosseum hackathon. Architecture, security model, and frontend decomposition pair-programmed with Claude Code (Anthropic).

// server/database.mjs
// SQLite-backed replacement for simple-db.mjs (JSON file).
//
// Why SQLite:
//   - Concurrent writers (the JSON debounce loses writes under load).
//   - Real indexes — wallet/username lookups stay O(log n) at scale.
//   - Foreign keys enforce referential integrity that the JSON store didn't.
//   - Atomic transactions for multi-row updates (completeContract, etc.).
//
// We keep the same `dbHelpers` API surface so index.mjs is a one-line import swap.
//
// On first boot:
//   - Schema is created via CREATE TABLE IF NOT EXISTS.
//   - If solskies.db is empty AND db.json exists, the migrator imports the legacy
//     data once. db.json is renamed to db.json.bak after a successful import so
//     it can't get re-imported on subsequent boots.

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'solskies.db');
const JSON_FILE = path.join(__dirname, 'db.json');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS operators (
    id                       TEXT PRIMARY KEY,
    wallet_address           TEXT UNIQUE NOT NULL,
    full_name                TEXT NOT NULL,
    username                 TEXT UNIQUE NOT NULL,
    region                   TEXT,
    drone_model              TEXT,
    drone_image              TEXT,
    flight_stack             TEXT,
    autopilot_hardware       TEXT,
    vehicle_type             TEXT,
    firmware_version         TEXT,
    communication_protocol   TEXT DEFAULT 'mavlink',
    experience               TEXT,
    certifications           TEXT DEFAULT '[]',     -- JSON array
    certification_files      TEXT DEFAULT '[]',     -- JSON array
    profile_image            TEXT,
    rating                   REAL,
    total_missions           INTEGER DEFAULT 0,
    completed_missions       INTEGER DEFAULT 0,
    total_earned             REAL    DEFAULT 0,
    positive_feedback        INTEGER DEFAULT 100,
    member_since             INTEGER NOT NULL,
    created_at               INTEGER NOT NULL,
    license_status           TEXT DEFAULT 'none',
    license_document_url     TEXT,
    bio                      TEXT,
    flight_hours             INTEGER DEFAULT 0,
    drone_fleet              TEXT DEFAULT '[]',     -- JSON array
    contact_email            TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_operators_wallet   ON operators(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_operators_username ON operators(username);

  CREATE TABLE IF NOT EXISTS enterprises (
    id                          TEXT PRIMARY KEY,
    wallet_address              TEXT UNIQUE NOT NULL,
    company_name                TEXT NOT NULL,
    business_type               TEXT,
    year_established            INTEGER,
    industry                    TEXT,
    operating_regions           TEXT,
    contact_name                TEXT,
    contact_email               TEXT,
    contact_phone               TEXT,
    website                     TEXT,
    description                 TEXT,
    usdc_balance                REAL    DEFAULT 1000,
    created_at                  INTEGER NOT NULL,
    business_verified           INTEGER DEFAULT 0,
    business_document_url       TEXT,
    business_certificate_url    TEXT,
    bio                         TEXT,
    logo_url                    TEXT,
    total_missions_posted       INTEGER DEFAULT 0,
    total_missions_completed    INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_enterprises_wallet ON enterprises(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_enterprises_name   ON enterprises(company_name);

  CREATE TABLE IF NOT EXISTS missions (
    id                          TEXT PRIMARY KEY,
    enterprise_id               TEXT NOT NULL,
    enterprise_name             TEXT,
    title                       TEXT NOT NULL,
    mission_type                TEXT,
    region                      TEXT,
    latitude                    REAL,
    longitude                   REAL,
    description                 TEXT,
    reward                      REAL NOT NULL,
    status                      TEXT DEFAULT 'open',
    escrow                      REAL,
    requirements                TEXT DEFAULT '{}',
    operators_needed            INTEGER DEFAULT 1,
    subtasks                    TEXT DEFAULT '[]',
    completed_at                INTEGER,
    created_at                  INTEGER NOT NULL,
    start_date                  TEXT,
    end_date                    TEXT,
    budget_usdc                 REAL,
    address                     TEXT,
    weather_cache               TEXT,
    attachments                 TEXT DEFAULT '[]',
    draft                       INTEGER DEFAULT 0,
    escrow_tx                   TEXT,
    escrow_deposited_lamports   INTEGER,
    escrow_status               TEXT DEFAULT 'pending',
    -- new for Phase 4
    required_certifications     TEXT DEFAULT '[]',
    required_min_hours          INTEGER DEFAULT 0,
    required_vehicle_types      TEXT DEFAULT '[]',
    required_payload            TEXT DEFAULT '[]',
    required_operators          INTEGER DEFAULT 1,
    FOREIGN KEY(enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_missions_enterprise ON missions(enterprise_id);
  CREATE INDEX IF NOT EXISTS idx_missions_status     ON missions(status);

  CREATE TABLE IF NOT EXISTS applications (
    id                  TEXT PRIMARY KEY,
    mission_id          TEXT NOT NULL,
    operator_id         TEXT NOT NULL,
    operator_name       TEXT,
    operator_username   TEXT,
    status              TEXT DEFAULT 'pending',
    message             TEXT,
    created_at          INTEGER NOT NULL,
    proposed_subtask_id TEXT,
    FOREIGN KEY(mission_id)  REFERENCES missions(id)  ON DELETE CASCADE,
    FOREIGN KEY(operator_id) REFERENCES operators(id) ON DELETE CASCADE,
    UNIQUE(mission_id, operator_id)
  );
  CREATE INDEX IF NOT EXISTS idx_applications_mission  ON applications(mission_id);
  CREATE INDEX IF NOT EXISTS idx_applications_operator ON applications(operator_id);

  CREATE TABLE IF NOT EXISTS contracts (
    id                  TEXT PRIMARY KEY,
    mission_id          TEXT,
    enterprise_id       TEXT NOT NULL,
    operator_id         TEXT NOT NULL,
    operator_name       TEXT,
    operator_username   TEXT,
    title               TEXT,
    description         TEXT,
    region              TEXT,
    amount_sol          REAL    DEFAULT 0,
    status              TEXT    DEFAULT 'active',
    progress            INTEGER DEFAULT 0,
    rating              REAL,
    comment             TEXT,
    completed_at        INTEGER,
    created_at          INTEGER NOT NULL,
    payout_tx           TEXT,
    payout_status       TEXT,
    FOREIGN KEY(mission_id)    REFERENCES missions(id),
    FOREIGN KEY(enterprise_id) REFERENCES enterprises(id),
    FOREIGN KEY(operator_id)   REFERENCES operators(id)
  );
  CREATE INDEX IF NOT EXISTS idx_contracts_enterprise ON contracts(enterprise_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_operator   ON contracts(operator_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_status     ON contracts(status);

  -- Legacy per-contract messages
  CREATE TABLE IF NOT EXISTS messages (
    id            TEXT PRIMARY KEY,
    contract_id   TEXT NOT NULL,
    sender_type   TEXT,
    sender_id     TEXT,
    sender_wallet TEXT,
    text          TEXT,
    timestamp     INTEGER NOT NULL,
    read          INTEGER DEFAULT 0,
    FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_messages_contract ON messages(contract_id);

  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT PRIMARY KEY,
    operator_id   TEXT NOT NULL,
    enterprise_id TEXT NOT NULL,
    contract_id   TEXT,
    created_at    INTEGER NOT NULL,
    FOREIGN KEY(operator_id)   REFERENCES operators(id)   ON DELETE CASCADE,
    FOREIGN KEY(enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_conv_operator   ON conversations(operator_id);
  CREATE INDEX IF NOT EXISTS idx_conv_enterprise ON conversations(enterprise_id);

  CREATE TABLE IF NOT EXISTS conv_messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id       TEXT NOT NULL,
    sender_role     TEXT NOT NULL,
    content         TEXT NOT NULL,
    timestamp       INTEGER NOT NULL,
    read            INTEGER DEFAULT 0,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_conv_messages_conv ON conv_messages(conversation_id);

  -- ── Phase 4 readiness — empty until we wire up multi-op + staking + disputes
  CREATE TABLE IF NOT EXISTS mission_slots (
    id            TEXT PRIMARY KEY,
    mission_id    TEXT NOT NULL,
    slot_index    INTEGER NOT NULL,
    operator_id   TEXT,
    status        TEXT DEFAULT 'open',  -- open | claimed | active | completed | failed
    requirements  TEXT DEFAULT '{}',
    claimed_at    INTEGER,
    completed_at  INTEGER,
    FOREIGN KEY(mission_id)  REFERENCES missions(id)  ON DELETE CASCADE,
    FOREIGN KEY(operator_id) REFERENCES operators(id),
    UNIQUE(mission_id, slot_index)
  );
  CREATE INDEX IF NOT EXISTS idx_slots_mission  ON mission_slots(mission_id);
  CREATE INDEX IF NOT EXISTS idx_slots_operator ON mission_slots(operator_id);

  CREATE TABLE IF NOT EXISTS operator_stakes (
    id              TEXT PRIMARY KEY,
    operator_id     TEXT NOT NULL,
    mission_id      TEXT NOT NULL,
    amount_lamports INTEGER NOT NULL,
    status          TEXT DEFAULT 'locked',  -- locked | released | slashed
    locked_at       INTEGER NOT NULL,
    settled_at      INTEGER,
    settle_tx       TEXT,
    FOREIGN KEY(operator_id) REFERENCES operators(id),
    FOREIGN KEY(mission_id)  REFERENCES missions(id)
  );
  CREATE INDEX IF NOT EXISTS idx_stakes_operator ON operator_stakes(operator_id);
  CREATE INDEX IF NOT EXISTS idx_stakes_mission  ON operator_stakes(mission_id);

  CREATE TABLE IF NOT EXISTS ratings (
    id              TEXT PRIMARY KEY,
    contract_id     TEXT NOT NULL,
    operator_id     TEXT NOT NULL,
    enterprise_id   TEXT NOT NULL,
    rating          REAL NOT NULL,
    comment         TEXT,
    created_at      INTEGER NOT NULL,
    FOREIGN KEY(contract_id)   REFERENCES contracts(id)   ON DELETE CASCADE,
    FOREIGN KEY(operator_id)   REFERENCES operators(id),
    FOREIGN KEY(enterprise_id) REFERENCES enterprises(id)
  );
  CREATE INDEX IF NOT EXISTS idx_ratings_operator ON ratings(operator_id);

  CREATE TABLE IF NOT EXISTS disputes (
    id              TEXT PRIMARY KEY,
    contract_id     TEXT NOT NULL,
    raised_by_role  TEXT NOT NULL,           -- operator | enterprise
    raised_by_id    TEXT NOT NULL,
    reason          TEXT,
    evidence        TEXT DEFAULT '[]',       -- JSON array of {url, type}
    status          TEXT DEFAULT 'open',     -- open | resolved | dismissed
    resolution      TEXT,
    created_at      INTEGER NOT NULL,
    resolved_at     INTEGER,
    FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_disputes_contract ON disputes(contract_id);

  -- Operator work history — "LinkedIn for drones" timeline.
  -- Each row is a self-reported past gig: company worked for, role, dates,
  -- region, and a free-text description of what was flown. Public on profile.
  CREATE TABLE IF NOT EXISTS operator_experiences (
    id            TEXT PRIMARY KEY,
    operator_id   TEXT NOT NULL,
    company       TEXT NOT NULL,
    role          TEXT NOT NULL,
    region        TEXT,
    industry      TEXT,
    start_date    TEXT,                   -- 'YYYY-MM' or 'YYYY-MM-DD'
    end_date      TEXT,                   -- null = current
    description   TEXT,
    drone_models  TEXT DEFAULT '[]',      -- JSON array
    image_url     TEXT,                   -- optional photo from the gig
    enterprise_id TEXT,                   -- optional FK if the company is on-platform
    created_at    INTEGER NOT NULL,
    FOREIGN KEY(operator_id) REFERENCES operators(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_experiences_operator ON operator_experiences(operator_id);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id           TEXT PRIMARY KEY,
    entity_type  TEXT,                        -- mission | contract | operator | enterprise | escrow
    entity_id    TEXT,
    action       TEXT NOT NULL,
    actor_id     TEXT,
    actor_role   TEXT,
    payload      TEXT,                        -- JSON
    timestamp    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs(actor_id);
`);

// ─── Lightweight in-place migrations ─────────────────────────────────────────
// SQLite's CREATE TABLE IF NOT EXISTS doesn't add new columns to existing
// tables. For schema bumps we ALTER TABLE inside try/catch — duplicate-column
// errors are swallowed so this is idempotent.
function safeAddColumn(table, column, defn) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${defn}`); }
  catch (e) { /* "duplicate column" is expected on subsequent boots */ }
}
safeAddColumn('operator_experiences', 'image_url',     'TEXT');
safeAddColumn('operator_experiences', 'enterprise_id', 'TEXT');

// ─── JSON column helpers ─────────────────────────────────────────────────────
const JSON_COLUMNS = {
  operators: ['certifications', 'certification_files', 'drone_fleet'],
  missions:  ['requirements', 'subtasks', 'attachments', 'required_certifications', 'required_vehicle_types', 'required_payload'],
};
const BOOL_COLUMNS = {
  operators: [],
  enterprises: ['business_verified'],
  missions: ['draft'],
  messages: ['read'],
  conv_messages: ['read'],
};

function parseJSON(value, fallback) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
function deserializeRow(table, row) {
  if (!row) return row;
  const out = { ...row };
  for (const col of JSON_COLUMNS[table] || []) {
    if (col in out) out[col] = parseJSON(out[col], Array.isArray(out[col]) ? [] : []);
  }
  for (const col of BOOL_COLUMNS[table] || []) {
    if (col in out) out[col] = !!out[col];
  }
  return out;
}
function serializeJSONField(v) {
  return v == null ? null : JSON.stringify(v);
}
function boolToInt(v) {
  return v ? 1 : 0;
}

// ─── Auto-migrator: db.json → SQLite (runs once) ─────────────────────────────
function migrateFromJSONIfNeeded() {
  const operatorCount = db.prepare('SELECT COUNT(*) as n FROM operators').get().n;
  const enterpriseCount = db.prepare('SELECT COUNT(*) as n FROM enterprises').get().n;
  if (operatorCount > 0 || enterpriseCount > 0) return;
  if (!fs.existsSync(JSON_FILE)) return;

  console.log('[db] solskies.db is empty and db.json exists — migrating…');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')); }
  catch (e) { console.warn('[db] db.json unreadable, skipping migration:', e.message); return; }

  const insertMany = db.transaction(() => {
    for (const op of raw.operators || [])    insertOperatorRow(op);
    for (const e of raw.enterprises || [])   insertEnterpriseRow(e);
    for (const m of raw.missions || [])      insertMissionRow(m);
    for (const a of raw.applications || []) {
      try { insertApplicationRow(a); } catch (err) { console.warn('[db] skipping bad application:', err.message); }
    }
    for (const c of raw.contracts || [])     insertContractRow(c);
    for (const m of raw.messages || [])      insertMessageRow(m);
    for (const c of raw.conversations || []) insertConversationRow(c);
    for (const m of raw.conv_messages || []) insertConvMessageRow(m);
  });
  try {
    insertMany();
    fs.renameSync(JSON_FILE, JSON_FILE + '.bak');
    console.log(`[db] Migration complete. db.json renamed to db.json.bak.`);
    console.log(`[db]   operators=${(raw.operators||[]).length}, enterprises=${(raw.enterprises||[]).length}, missions=${(raw.missions||[]).length}, contracts=${(raw.contracts||[]).length}`);
  } catch (e) {
    console.error('[db] Migration failed — rolling back:', e.message);
    throw e;
  }
}

function insertOperatorRow(op) {
  db.prepare(`INSERT INTO operators (
    id, wallet_address, full_name, username, region, drone_model, drone_image,
    flight_stack, autopilot_hardware, vehicle_type, firmware_version, communication_protocol,
    experience, certifications, certification_files, profile_image, rating,
    total_missions, completed_missions, total_earned, positive_feedback,
    member_since, created_at, license_status, license_document_url,
    bio, flight_hours, drone_fleet, contact_email
  ) VALUES (
    @id, @wallet_address, @full_name, @username, @region, @drone_model, @drone_image,
    @flight_stack, @autopilot_hardware, @vehicle_type, @firmware_version, @communication_protocol,
    @experience, @certifications, @certification_files, @profile_image, @rating,
    @total_missions, @completed_missions, @total_earned, @positive_feedback,
    @member_since, @created_at, @license_status, @license_document_url,
    @bio, @flight_hours, @drone_fleet, @contact_email
  )`).run({
    id: op.id || randomUUID(),
    wallet_address: op.wallet_address,
    full_name: op.full_name,
    username: op.username,
    region: op.region ?? null,
    drone_model: op.drone_model ?? null,
    drone_image: op.drone_image ?? null,
    flight_stack: op.flight_stack ?? null,
    autopilot_hardware: op.autopilot_hardware ?? null,
    vehicle_type: op.vehicle_type ?? null,
    firmware_version: op.firmware_version ?? null,
    communication_protocol: op.communication_protocol || 'mavlink',
    experience: op.experience ?? null,
    certifications: serializeJSONField(op.certifications || []),
    certification_files: serializeJSONField(op.certification_files || []),
    profile_image: op.profile_image ?? null,
    rating: op.rating ?? null,
    total_missions: op.total_missions ?? 0,
    completed_missions: op.completed_missions ?? 0,
    total_earned: op.total_earned ?? 0,
    positive_feedback: op.positive_feedback ?? 100,
    member_since: op.member_since || op.created_at || Date.now(),
    created_at: op.created_at || Date.now(),
    license_status: op.license_status || 'none',
    license_document_url: op.license_document_url ?? null,
    bio: op.bio ?? null,
    flight_hours: op.flight_hours ?? 0,
    drone_fleet: serializeJSONField(op.drone_fleet || []),
    contact_email: op.contact_email ?? null,
  });
}

function insertEnterpriseRow(e) {
  db.prepare(`INSERT INTO enterprises (
    id, wallet_address, company_name, business_type, year_established, industry,
    operating_regions, contact_name, contact_email, contact_phone, website, description,
    usdc_balance, created_at, business_verified, business_document_url, business_certificate_url,
    bio, logo_url, total_missions_posted, total_missions_completed
  ) VALUES (
    @id, @wallet_address, @company_name, @business_type, @year_established, @industry,
    @operating_regions, @contact_name, @contact_email, @contact_phone, @website, @description,
    @usdc_balance, @created_at, @business_verified, @business_document_url, @business_certificate_url,
    @bio, @logo_url, @total_missions_posted, @total_missions_completed
  )`).run({
    id: e.id || randomUUID(),
    wallet_address: e.wallet_address,
    company_name: e.company_name,
    business_type: e.business_type ?? null,
    year_established: e.year_established ?? null,
    industry: e.industry ?? null,
    operating_regions: e.operating_regions ?? null,
    contact_name: e.contact_name ?? null,
    contact_email: e.contact_email ?? null,
    contact_phone: e.contact_phone ?? null,
    website: e.website ?? null,
    description: e.description ?? null,
    usdc_balance: e.usdc_balance ?? 1000,
    created_at: e.created_at || Date.now(),
    business_verified: boolToInt(e.business_verified),
    business_document_url: e.business_document_url ?? null,
    business_certificate_url: e.business_certificate_url ?? null,
    bio: e.bio ?? null,
    logo_url: e.logo_url ?? null,
    total_missions_posted: e.total_missions_posted ?? 0,
    total_missions_completed: e.total_missions_completed ?? 0,
  });
}

function insertMissionRow(m) {
  db.prepare(`INSERT INTO missions (
    id, enterprise_id, enterprise_name, title, mission_type, region, latitude, longitude,
    description, reward, status, escrow, requirements, operators_needed, subtasks,
    completed_at, created_at, start_date, end_date, budget_usdc, address, weather_cache,
    attachments, draft, escrow_tx, escrow_deposited_lamports, escrow_status,
    required_certifications, required_min_hours, required_vehicle_types, required_payload, required_operators
  ) VALUES (
    @id, @enterprise_id, @enterprise_name, @title, @mission_type, @region, @latitude, @longitude,
    @description, @reward, @status, @escrow, @requirements, @operators_needed, @subtasks,
    @completed_at, @created_at, @start_date, @end_date, @budget_usdc, @address, @weather_cache,
    @attachments, @draft, @escrow_tx, @escrow_deposited_lamports, @escrow_status,
    @required_certifications, @required_min_hours, @required_vehicle_types, @required_payload, @required_operators
  )`).run({
    id: m.id || randomUUID(),
    enterprise_id: m.enterprise_id,
    enterprise_name: m.enterprise_name ?? null,
    title: m.title,
    mission_type: m.mission_type ?? null,
    region: m.region ?? null,
    latitude: m.latitude ?? null,
    longitude: m.longitude ?? null,
    description: m.description ?? null,
    reward: m.reward ?? 0,
    status: m.status || 'open',
    escrow: m.escrow ?? m.reward ?? null,
    requirements: serializeJSONField(m.requirements || {}),
    operators_needed: m.operators_needed ?? 1,
    subtasks: serializeJSONField(m.subtasks || []),
    completed_at: m.completed_at ?? null,
    created_at: m.created_at || Date.now(),
    start_date: m.start_date ?? null,
    end_date: m.end_date ?? null,
    budget_usdc: m.budget_usdc ?? null,
    address: m.address ?? null,
    weather_cache: m.weather_cache ?? null,
    attachments: serializeJSONField(m.attachments || []),
    draft: boolToInt(m.draft),
    escrow_tx: m.escrow_tx ?? null,
    escrow_deposited_lamports: m.escrow_deposited_lamports ?? null,
    escrow_status: m.escrow_status || 'pending',
    required_certifications: serializeJSONField(m.required_certifications || []),
    required_min_hours: m.required_min_hours ?? 0,
    required_vehicle_types: serializeJSONField(m.required_vehicle_types || []),
    required_payload: serializeJSONField(m.required_payload || []),
    required_operators: m.required_operators ?? 1,
  });
}

function insertApplicationRow(a) {
  db.prepare(`INSERT INTO applications (
    id, mission_id, operator_id, operator_name, operator_username, status, message, created_at, proposed_subtask_id
  ) VALUES (
    @id, @mission_id, @operator_id, @operator_name, @operator_username, @status, @message, @created_at, @proposed_subtask_id
  )`).run({
    id: a.id || randomUUID(),
    mission_id: a.mission_id,
    operator_id: a.operator_id,
    operator_name: a.operator_name ?? null,
    operator_username: a.operator_username ?? null,
    status: a.status || 'pending',
    message: a.message ?? null,
    created_at: a.created_at || Date.now(),
    proposed_subtask_id: a.proposed_subtask_id ?? null,
  });
}

function insertContractRow(c) {
  db.prepare(`INSERT INTO contracts (
    id, mission_id, enterprise_id, operator_id, operator_name, operator_username,
    title, description, region, amount_sol, status, progress, rating, comment,
    completed_at, created_at, payout_tx, payout_status
  ) VALUES (
    @id, @mission_id, @enterprise_id, @operator_id, @operator_name, @operator_username,
    @title, @description, @region, @amount_sol, @status, @progress, @rating, @comment,
    @completed_at, @created_at, @payout_tx, @payout_status
  )`).run({
    id: c.id || randomUUID(),
    mission_id: c.mission_id ?? null,
    enterprise_id: c.enterprise_id,
    operator_id: c.operator_id,
    operator_name: c.operator_name ?? null,
    operator_username: c.operator_username ?? null,
    title: c.title ?? null,
    description: c.description ?? null,
    region: c.region ?? null,
    amount_sol: c.amount_sol ?? 0,
    status: c.status || 'active',
    progress: c.progress ?? 0,
    rating: c.rating ?? null,
    comment: c.comment ?? null,
    completed_at: c.completed_at ?? null,
    created_at: c.created_at || Date.now(),
    payout_tx: c.payout_tx ?? null,
    payout_status: c.payout_status ?? null,
  });
}

function insertMessageRow(m) {
  db.prepare(`INSERT INTO messages (id, contract_id, sender_type, sender_id, sender_wallet, text, timestamp, read)
    VALUES (@id, @contract_id, @sender_type, @sender_id, @sender_wallet, @text, @timestamp, @read)`).run({
    id: m.id || randomUUID(),
    contract_id: m.contract_id,
    sender_type: m.sender_type ?? null,
    sender_id: m.sender_id ?? null,
    sender_wallet: m.sender_wallet ?? null,
    text: m.text ?? m.message ?? null,
    timestamp: m.timestamp || Date.now(),
    read: boolToInt(m.read),
  });
}

function insertConversationRow(c) {
  db.prepare(`INSERT INTO conversations (id, operator_id, enterprise_id, contract_id, created_at)
    VALUES (@id, @operator_id, @enterprise_id, @contract_id, @created_at)`).run({
    id: c.id || randomUUID(),
    operator_id: c.operator_id,
    enterprise_id: c.enterprise_id,
    contract_id: c.contract_id ?? null,
    created_at: c.created_at || Date.now(),
  });
}

function insertConvMessageRow(m) {
  db.prepare(`INSERT INTO conv_messages (id, conversation_id, sender_id, sender_role, content, timestamp, read)
    VALUES (@id, @conversation_id, @sender_id, @sender_role, @content, @timestamp, @read)`).run({
    id: m.id || randomUUID(),
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    sender_role: m.sender_role,
    content: m.content,
    timestamp: m.timestamp || Date.now(),
    read: boolToInt(m.read),
  });
}

migrateFromJSONIfNeeded();

// ─── dbHelpers ────────────────────────────────────────────────────────────────
// Mirrors simple-db.mjs API exactly so index.mjs is a drop-in import swap.

const opSelect = (where, params = {}) =>
  deserializeRow('operators', db.prepare(`SELECT * FROM operators WHERE ${where}`).get(params));

export const dbHelpers = {
  // ── Operators ──────────────────────────────────────────────────────────────
  createOperator(data) {
    const id = randomUUID();
    const now = Date.now();
    insertOperatorRow({
      id,
      wallet_address: data.wallet_address,
      full_name: data.full_name,
      username: data.username,
      region: data.region ?? null,
      drone_model: data.drone_model ?? null,
      drone_image: data.drone_image ?? null,
      flight_stack: data.flight_stack ?? null,
      autopilot_hardware: data.autopilot_hardware ?? null,
      vehicle_type: data.vehicle_type ?? null,
      firmware_version: data.firmware_version ?? null,
      communication_protocol: data.communication_protocol || 'mavlink',
      experience: data.experience ?? null,
      certifications: data.certifications || [],
      certification_files: data.certification_files || [],
      profile_image: null,
      rating: null,
      total_missions: 0,
      completed_missions: 0,
      total_earned: 0,
      positive_feedback: 100,
      member_since: now,
      created_at: now,
      license_status: 'none',
      license_document_url: null,
      bio: data.bio ?? null,
      flight_hours: data.flight_hours ?? 0,
      drone_fleet: data.drone_fleet || [],
    });
    return this.getOperatorById(id);
  },

  getOperatorByWallet(wallet)   { return opSelect('wallet_address = @w', { w: wallet }) || null; },
  getOperatorById(id)           { return opSelect('id = @id', { id }) || null; },
  getOperatorByUsername(name)   {
    const row = db.prepare('SELECT * FROM operators WHERE LOWER(username) = LOWER(?)').get(name);
    return deserializeRow('operators', row) || null;
  },
  getAllOperators() {
    return db.prepare('SELECT * FROM operators ORDER BY created_at DESC').all().map(r => deserializeRow('operators', r));
  },

  updateOperator(id, updates) {
    const existing = this.getOperatorById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    // Re-serialize JSON columns
    const params = {
      id,
      full_name: merged.full_name,
      username: merged.username,
      region: merged.region ?? null,
      drone_model: merged.drone_model ?? null,
      drone_image: merged.drone_image ?? null,
      flight_stack: merged.flight_stack ?? null,
      autopilot_hardware: merged.autopilot_hardware ?? null,
      vehicle_type: merged.vehicle_type ?? null,
      firmware_version: merged.firmware_version ?? null,
      communication_protocol: merged.communication_protocol || 'mavlink',
      experience: merged.experience ?? null,
      certifications: serializeJSONField(merged.certifications || []),
      certification_files: serializeJSONField(merged.certification_files || []),
      profile_image: merged.profile_image ?? null,
      rating: merged.rating ?? null,
      total_missions: merged.total_missions ?? 0,
      completed_missions: merged.completed_missions ?? 0,
      total_earned: merged.total_earned ?? 0,
      positive_feedback: merged.positive_feedback ?? 100,
      license_status: merged.license_status || 'none',
      license_document_url: merged.license_document_url ?? null,
      bio: merged.bio ?? null,
      flight_hours: merged.flight_hours ?? 0,
      drone_fleet: serializeJSONField(merged.drone_fleet || []),
      contact_email: merged.contact_email ?? null,
    };
    db.prepare(`UPDATE operators SET
      full_name=@full_name, username=@username, region=@region, drone_model=@drone_model,
      drone_image=@drone_image, flight_stack=@flight_stack, autopilot_hardware=@autopilot_hardware,
      vehicle_type=@vehicle_type, firmware_version=@firmware_version,
      communication_protocol=@communication_protocol, experience=@experience,
      certifications=@certifications, certification_files=@certification_files,
      profile_image=@profile_image, rating=@rating,
      total_missions=@total_missions, completed_missions=@completed_missions,
      total_earned=@total_earned, positive_feedback=@positive_feedback,
      license_status=@license_status, license_document_url=@license_document_url,
      bio=@bio, flight_hours=@flight_hours, drone_fleet=@drone_fleet,
      contact_email=@contact_email
      WHERE id=@id`).run(params);
    return this.getOperatorById(id);
  },

  deleteOperator(id) {
    db.prepare('DELETE FROM operators WHERE id = ?').run(id);
    return true;
  },
  deleteOperatorByWallet(wallet) {
    db.prepare('DELETE FROM operators WHERE wallet_address = ?').run(wallet);
    return true;
  },

  // ── Operator Dashboard ─────────────────────────────────────────────────────
  getOperatorDashboard(operatorId) {
    const operator = this.getOperatorById(operatorId);
    if (!operator) return null;

    const contracts = db.prepare(`
      SELECT c.*,
        COALESCE(c.title, m.title) AS title,
        e.company_name AS client_name,
        COALESCE(c.enterprise_id, m.enterprise_id) AS enterprise_id,
        COALESCE(c.region, m.region) AS region,
        COALESCE(c.amount_sol, m.reward, 0) AS amount_sol,
        e.industry AS industry
      FROM contracts c
      LEFT JOIN missions m    ON m.id = c.mission_id
      LEFT JOIN enterprises e ON e.id = COALESCE(c.enterprise_id, m.enterprise_id)
      WHERE c.operator_id = ?
      ORDER BY c.created_at DESC
    `).all(operatorId);

    return {
      ...operator,
      license_status: operator.license_status || 'none',
      bio: operator.bio || null,
      flight_hours: operator.flight_hours || 0,
      contracts,
    };
  },

  // ── Enterprises ────────────────────────────────────────────────────────────
  createEnterprise(data) {
    const id = randomUUID();
    insertEnterpriseRow({
      id,
      wallet_address: data.wallet_address,
      company_name: data.company_name,
      business_type: data.business_type ?? null,
      year_established: data.year_established ?? null,
      industry: data.industry ?? null,
      operating_regions: data.operating_regions ?? null,
      contact_name: data.contact_name ?? null,
      contact_email: data.contact_email ?? null,
      contact_phone: data.contact_phone ?? null,
      website: data.website ?? null,
      description: data.description ?? null,
      usdc_balance: 1000,
      created_at: Date.now(),
      business_verified: false,
      business_document_url: data.business_certificate_url ?? null,
      business_certificate_url: data.business_certificate_url ?? null,
      bio: data.bio ?? null,
      logo_url: null,
      total_missions_posted: 0,
      total_missions_completed: 0,
    });
    return this.getEnterpriseById(id);
  },

  getEnterpriseByWallet(wallet) {
    const row = db.prepare('SELECT * FROM enterprises WHERE wallet_address = ?').get(wallet);
    return deserializeRow('enterprises', row) || null;
  },
  getEnterpriseById(id) {
    const row = db.prepare('SELECT * FROM enterprises WHERE id = ?').get(id);
    return deserializeRow('enterprises', row) || null;
  },
  getEnterpriseByName(name) {
    const slug = (name || '').toLowerCase();
    const all = db.prepare('SELECT * FROM enterprises').all();
    const row = all.find(e => (e.company_name || '').toLowerCase().replace(/\s+/g, '-') === slug);
    return deserializeRow('enterprises', row) || null;
  },
  getAllEnterprises() {
    return db.prepare('SELECT * FROM enterprises ORDER BY created_at DESC').all().map(r => deserializeRow('enterprises', r));
  },

  updateEnterprise(id, updates) {
    const existing = this.getEnterpriseById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    const params = {
      id,
      company_name: merged.company_name,
      business_type: merged.business_type ?? null,
      year_established: merged.year_established ?? null,
      industry: merged.industry ?? null,
      operating_regions: merged.operating_regions ?? null,
      contact_name: merged.contact_name ?? null,
      contact_email: merged.contact_email ?? null,
      contact_phone: merged.contact_phone ?? null,
      website: merged.website ?? null,
      description: merged.description ?? null,
      usdc_balance: merged.usdc_balance ?? 0,
      business_verified: boolToInt(merged.business_verified),
      business_document_url: merged.business_document_url ?? null,
      business_certificate_url: merged.business_certificate_url ?? null,
      bio: merged.bio ?? null,
      logo_url: merged.logo_url ?? null,
      total_missions_posted: merged.total_missions_posted ?? 0,
      total_missions_completed: merged.total_missions_completed ?? 0,
    };
    db.prepare(`UPDATE enterprises SET
      company_name=@company_name, business_type=@business_type, year_established=@year_established,
      industry=@industry, operating_regions=@operating_regions, contact_name=@contact_name,
      contact_email=@contact_email, contact_phone=@contact_phone, website=@website,
      description=@description, usdc_balance=@usdc_balance, business_verified=@business_verified,
      business_document_url=@business_document_url, business_certificate_url=@business_certificate_url,
      bio=@bio, logo_url=@logo_url, total_missions_posted=@total_missions_posted,
      total_missions_completed=@total_missions_completed
      WHERE id=@id`).run(params);
    return this.getEnterpriseById(id);
  },

  deleteEnterpriseByWallet(wallet) {
    db.prepare('DELETE FROM enterprises WHERE wallet_address = ?').run(wallet);
    return true;
  },

  // ── Availability checks ────────────────────────────────────────────────────
  checkUsername(username) {
    if (!username) return false;
    const row = db.prepare('SELECT 1 FROM operators WHERE LOWER(username) = LOWER(?) LIMIT 1').get(username);
    return !row;
  },
  checkCompanyName(name) {
    if (!name) return false;
    const row = db.prepare('SELECT 1 FROM enterprises WHERE LOWER(company_name) = LOWER(?) LIMIT 1').get(name);
    return !row;
  },
  checkWallet(wallet) {
    if (!wallet) return false;
    const op = db.prepare('SELECT 1 FROM operators   WHERE wallet_address = ? LIMIT 1').get(wallet);
    if (op) return false;
    const en = db.prepare('SELECT 1 FROM enterprises WHERE wallet_address = ? LIMIT 1').get(wallet);
    return !en;
  },

  findUserByWallet(wallet) {
    const op = db.prepare('SELECT id, full_name, username FROM operators WHERE wallet_address = ?').get(wallet);
    if (op) return { id: op.id, fullName: op.full_name, username: op.username, walletAddress: wallet, role: 'operator' };
    const en = db.prepare('SELECT id, contact_name, company_name FROM enterprises WHERE wallet_address = ?').get(wallet);
    if (en) return { id: en.id, fullName: en.contact_name, companyName: en.company_name, walletAddress: wallet, role: 'enterprise' };
    return null;
  },

  // ── Missions ───────────────────────────────────────────────────────────────
  createMission(data) {
    const id = randomUUID();
    insertMissionRow({
      id,
      enterprise_id: data.enterprise_id,
      enterprise_name: data.enterprise_name ?? null,
      title: data.title,
      mission_type: data.missionType || data.mission_type || 'inspection',
      region: data.region ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      description: data.description ?? null,
      reward: data.reward,
      status: data.status || 'open',
      escrow: data.escrow || data.reward,
      requirements: data.requirements || {},
      operators_needed: data.operators_needed || data.required_operators || 1,
      subtasks: data.subtasks || [],
      completed_at: null,
      created_at: Date.now(),
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      budget_usdc: data.budget_usdc ?? data.reward ?? 0,
      address: data.address ?? null,
      weather_cache: null,
      attachments: data.attachments || [],
      draft: data.draft || false,
      escrow_tx: data.escrow_tx ?? null,
      escrow_deposited_lamports: data.escrow_deposited_lamports ?? null,
      escrow_status: data.escrow_status || 'pending',
      required_certifications: data.required_certifications || [],
      required_min_hours: data.required_min_hours ?? 0,
      required_vehicle_types: data.required_vehicle_types || [],
      required_payload: data.required_payload || [],
      required_operators: data.required_operators ?? data.operators_needed ?? 1,
    });
    return this.getMissionById(id);
  },

  getMissions(filters = {}) {
    const where = [], params = {};
    if (filters.enterprise_id) { where.push('enterprise_id = @enterprise_id'); params.enterprise_id = filters.enterprise_id; }
    if (filters.status)        { where.push('status = @status');               params.status = filters.status; }
    if (filters.region)        { where.push('LOWER(region) LIKE @region');     params.region = `%${filters.region.toLowerCase()}%`; }
    const sql = `SELECT * FROM missions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    return db.prepare(sql).all(params).map(r => deserializeRow('missions', r));
  },

  getMissionById(id) {
    const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id);
    return deserializeRow('missions', row) || null;
  },

  updateMission(id, updates) {
    const existing = this.getMissionById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    const params = {
      id,
      enterprise_name: merged.enterprise_name ?? null,
      title: merged.title,
      mission_type: merged.mission_type ?? null,
      region: merged.region ?? null,
      latitude: merged.latitude ?? null,
      longitude: merged.longitude ?? null,
      description: merged.description ?? null,
      reward: merged.reward ?? 0,
      status: merged.status || 'open',
      escrow: merged.escrow ?? null,
      requirements: serializeJSONField(merged.requirements || {}),
      operators_needed: merged.operators_needed ?? 1,
      subtasks: serializeJSONField(merged.subtasks || []),
      completed_at: merged.completed_at ?? null,
      start_date: merged.start_date ?? null,
      end_date: merged.end_date ?? null,
      budget_usdc: merged.budget_usdc ?? null,
      address: merged.address ?? null,
      weather_cache: merged.weather_cache ?? null,
      attachments: serializeJSONField(merged.attachments || []),
      draft: boolToInt(merged.draft),
      escrow_tx: merged.escrow_tx ?? null,
      escrow_deposited_lamports: merged.escrow_deposited_lamports ?? null,
      escrow_status: merged.escrow_status || 'pending',
      required_certifications: serializeJSONField(merged.required_certifications || []),
      required_min_hours: merged.required_min_hours ?? 0,
      required_vehicle_types: serializeJSONField(merged.required_vehicle_types || []),
      required_payload: serializeJSONField(merged.required_payload || []),
      required_operators: merged.required_operators ?? 1,
    };
    db.prepare(`UPDATE missions SET
      enterprise_name=@enterprise_name, title=@title, mission_type=@mission_type, region=@region,
      latitude=@latitude, longitude=@longitude, description=@description, reward=@reward,
      status=@status, escrow=@escrow, requirements=@requirements, operators_needed=@operators_needed,
      subtasks=@subtasks, completed_at=@completed_at, start_date=@start_date, end_date=@end_date,
      budget_usdc=@budget_usdc, address=@address, weather_cache=@weather_cache,
      attachments=@attachments, draft=@draft, escrow_tx=@escrow_tx,
      escrow_deposited_lamports=@escrow_deposited_lamports, escrow_status=@escrow_status,
      required_certifications=@required_certifications, required_min_hours=@required_min_hours,
      required_vehicle_types=@required_vehicle_types, required_payload=@required_payload,
      required_operators=@required_operators
      WHERE id=@id`).run(params);
    return this.getMissionById(id);
  },

  // ── Applications ───────────────────────────────────────────────────────────
  createApplication(data) {
    const id = randomUUID();
    insertApplicationRow({
      id,
      mission_id: data.mission_id,
      operator_id: data.operator_id,
      operator_name: data.operator_name ?? null,
      operator_username: data.operator_username ?? null,
      status: 'pending',
      message: data.message ?? null,
      created_at: Date.now(),
      proposed_subtask_id: data.proposed_subtask_id ?? null,
    });
    return db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  },

  getApplicationById(id) {
    return db.prepare('SELECT * FROM applications WHERE id = ?').get(id) || null;
  },

  getApplicationsByMission(missionId) {
    return db.prepare(`
      SELECT a.*,
        COALESCE(o.full_name, a.operator_name) AS operator_name,
        COALESCE(o.username,  a.operator_username) AS operator_username,
        o.region AS operator_region,
        o.experience AS operator_experience,
        o.certifications AS operator_certifications,
        o.drone_model AS operator_drone_model,
        o.rating AS operator_rating,
        o.completed_missions AS operator_completed_missions
      FROM applications a
      LEFT JOIN operators o ON o.id = a.operator_id
      WHERE a.mission_id = ?
      ORDER BY a.created_at DESC
    `).all(missionId).map(row => ({
      ...row,
      operator_certifications: parseJSON(row.operator_certifications, []),
    }));
  },

  getApplicationsByOperator(operatorId) {
    return db.prepare(`
      SELECT a.*,
        m.title AS mission_title,
        m.region AS mission_region,
        m.reward AS mission_reward,
        e.company_name AS enterprise_name
      FROM applications a
      LEFT JOIN missions m    ON m.id = a.mission_id
      LEFT JOIN enterprises e ON e.id = m.enterprise_id
      WHERE a.operator_id = ?
      ORDER BY a.created_at DESC
    `).all(operatorId);
  },

  updateApplication(id, updates) {
    const existing = this.getApplicationById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    db.prepare(`UPDATE applications SET status=@status, message=@message WHERE id=@id`).run({
      id, status: merged.status, message: merged.message ?? null,
    });
    return this.getApplicationById(id);
  },

  hasApplied(missionId, operatorId) {
    const row = db.prepare('SELECT 1 FROM applications WHERE mission_id = ? AND operator_id = ? LIMIT 1').get(missionId, operatorId);
    return !!row;
  },

  // ── Contracts ──────────────────────────────────────────────────────────────
  createContract(data) {
    const id = randomUUID();
    insertContractRow({
      id,
      mission_id: data.mission_id ?? null,
      enterprise_id: data.enterprise_id,
      operator_id: data.operator_id,
      operator_name: data.operator_name ?? null,
      operator_username: data.operator_username ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      region: data.region ?? null,
      amount_sol: data.amount_sol ?? 0,
      status: data.status || 'active',
      progress: 0,
      rating: null,
      comment: null,
      completed_at: null,
      created_at: Date.now(),
    });
    return this.getContractById(id);
  },

  getContractById(id) {
    return db.prepare('SELECT * FROM contracts WHERE id = ?').get(id) || null;
  },

  getContracts(filters = {}) {
    const where = [], params = {};
    if (filters.enterprise_id) { where.push('enterprise_id = @enterprise_id'); params.enterprise_id = filters.enterprise_id; }
    if (filters.operator_id)   { where.push('operator_id = @operator_id');     params.operator_id = filters.operator_id; }
    if (filters.status)        { where.push('status = @status');               params.status = filters.status; }
    const sql = `SELECT * FROM contracts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    return db.prepare(sql).all(params);
  },

  updateContract(id, updates) {
    const existing = this.getContractById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    db.prepare(`UPDATE contracts SET
      mission_id=@mission_id, operator_name=@operator_name, operator_username=@operator_username,
      title=@title, description=@description, region=@region, amount_sol=@amount_sol,
      status=@status, progress=@progress, rating=@rating, comment=@comment,
      completed_at=@completed_at, payout_tx=@payout_tx, payout_status=@payout_status
      WHERE id=@id`).run({
      id,
      mission_id: merged.mission_id ?? null,
      operator_name: merged.operator_name ?? null,
      operator_username: merged.operator_username ?? null,
      title: merged.title ?? null,
      description: merged.description ?? null,
      region: merged.region ?? null,
      amount_sol: merged.amount_sol ?? 0,
      status: merged.status || 'active',
      progress: merged.progress ?? 0,
      rating: merged.rating ?? null,
      comment: merged.comment ?? null,
      completed_at: merged.completed_at ?? null,
      payout_tx: merged.payout_tx ?? null,
      payout_status: merged.payout_status ?? null,
    });
    return this.getContractById(id);
  },

  // ── Atomic mission completion + rating roll-up ─────────────────────────────
  completeContract(contractId, rating, comment = null) {
    return db.transaction(() => {
      const contract = this.getContractById(contractId);
      if (!contract) return null;
      if (contract.status === 'completed') {
        return { contract, operator: this.getOperatorById(contract.operator_id) };
      }

      const now = Date.now();
      db.prepare(`UPDATE contracts SET status='completed', rating=?, comment=?, completed_at=?, progress=100 WHERE id=?`)
        .run(parseFloat(rating), comment || null, now, contractId);

      const op = this.getOperatorById(contract.operator_id);
      if (op) {
        const prevCompleted = op.completed_missions || 0;
        const prevRating = op.rating;
        const newRating = prevRating == null
          ? parseFloat(rating)
          : parseFloat(((prevRating * prevCompleted + parseFloat(rating)) / (prevCompleted + 1)).toFixed(2));
        db.prepare(`UPDATE operators SET
          completed_missions=?, total_missions=?, total_earned=?, rating=?
          WHERE id=?`).run(
          prevCompleted + 1,
          (op.total_missions || 0) + 1,
          (op.total_earned || 0) + (contract.amount_sol || 0),
          newRating,
          op.id,
        );
      }

      // Persist rating row for audit / multi-rating support.
      db.prepare(`INSERT INTO ratings (id, contract_id, operator_id, enterprise_id, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        randomUUID(), contractId, contract.operator_id, contract.enterprise_id,
        parseFloat(rating), comment || null, now,
      );

      if (contract.mission_id) {
        db.prepare(`UPDATE missions SET status='completed', completed_at=? WHERE id=?`).run(now, contract.mission_id);
      }

      return {
        contract: this.getContractById(contractId),
        operator: this.getOperatorById(contract.operator_id),
      };
    })();
  },

  withdrawEarnings(operatorId, amount) {
    const op = this.getOperatorById(operatorId);
    if (!op) return null;
    const available = op.total_earned || 0;
    if (amount > available) return { error: `Insufficient earnings. Available: ${available} SOL` };
    const newTotal = parseFloat((available - amount).toFixed(4));
    db.prepare('UPDATE operators SET total_earned = ? WHERE id = ?').run(newTotal, operatorId);
    return { operator: this.getOperatorById(operatorId), withdrawn: amount };
  },

  // ── Messages (legacy per-contract) ─────────────────────────────────────────
  createMessage(data) {
    const id = randomUUID();
    insertMessageRow({
      id,
      contract_id: data.contract_id,
      sender_type: data.sender_type ?? null,
      sender_id: data.sender_id ?? null,
      sender_wallet: data.sender_wallet ?? null,
      text: data.text ?? data.message ?? null,
      timestamp: Date.now(),
      read: false,
    });
    return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  },

  getMessages(contractId) {
    return db.prepare('SELECT * FROM messages WHERE contract_id = ? ORDER BY timestamp ASC').all(contractId)
      .map(r => ({ ...r, read: !!r.read }));
  },

  markMessagesRead(contractId, readerType) {
    db.prepare(`UPDATE messages SET read = 1 WHERE contract_id = ? AND sender_type != ?`).run(contractId, readerType);
  },

  // ── Conversations ──────────────────────────────────────────────────────────
  getOrCreateConversation(operatorId, enterpriseId, contractId = null) {
    const existing = contractId
      ? db.prepare('SELECT * FROM conversations WHERE operator_id = ? AND enterprise_id = ? AND contract_id = ?').get(operatorId, enterpriseId, contractId)
      : db.prepare('SELECT * FROM conversations WHERE operator_id = ? AND enterprise_id = ?').get(operatorId, enterpriseId);
    if (existing) return existing;
    const id = randomUUID();
    insertConversationRow({ id, operator_id: operatorId, enterprise_id: enterpriseId, contract_id: contractId, created_at: Date.now() });
    return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  },

  getConversationById(id) {
    return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) || null;
  },

  getConversationsByUser(userId, role) {
    const sql = role === 'operator'
      ? 'SELECT * FROM conversations WHERE operator_id = ?'
      : 'SELECT * FROM conversations WHERE enterprise_id = ?';
    const convs = db.prepare(sql).all(userId);

    return convs.map(conv => {
      const lastMsg = db.prepare('SELECT * FROM conv_messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 1').get(conv.id);
      const unread = db.prepare('SELECT COUNT(*) AS n FROM conv_messages WHERE conversation_id = ? AND read = 0 AND sender_id != ?').get(conv.id, userId).n;

      const otherParty = role === 'operator'
        ? db.prepare('SELECT company_name FROM enterprises WHERE id = ?').get(conv.enterprise_id)
        : db.prepare('SELECT full_name, username FROM operators WHERE id = ?').get(conv.operator_id);

      return {
        ...conv,
        other_name: role === 'operator'
          ? (otherParty?.company_name || 'Enterprise')
          : (otherParty?.full_name || 'Operator'),
        other_username: role === 'enterprise' ? (otherParty?.username || null) : null,
        last_message: lastMsg?.content || null,
        last_message_time: lastMsg?.timestamp || conv.created_at,
        unread_count: unread,
      };
    }).sort((a, b) => b.last_message_time - a.last_message_time);
  },

  getConvMessages(conversationId) {
    return db.prepare('SELECT * FROM conv_messages WHERE conversation_id = ? ORDER BY timestamp ASC').all(conversationId)
      .map(r => ({ ...r, read: !!r.read }));
  },

  createConvMessage(data) {
    const id = randomUUID();
    insertConvMessageRow({
      id,
      conversation_id: data.conversation_id,
      sender_id: data.sender_id,
      sender_role: data.sender_role,
      content: data.content,
      timestamp: Date.now(),
      read: false,
    });
    return db.prepare('SELECT * FROM conv_messages WHERE id = ?').get(id);
  },

  markConvMessagesRead(conversationId, readerId) {
    db.prepare(`UPDATE conv_messages SET read = 1 WHERE conversation_id = ? AND sender_id != ?`).run(conversationId, readerId);
  },

  // ── Public profiles (richer than the bare operator row) ────────────────────
  getOperatorProfile(operatorId) {
    const op = this.getOperatorById(operatorId);
    if (!op) return null;
    return {
      id: op.id,
      full_name: op.full_name,
      username: op.username,
      region: op.region,
      bio: op.bio || null,
      drone_model: op.drone_model,
      vehicle_type: op.vehicle_type,
      experience: op.experience,
      certifications: op.certifications || [],
      profile_image: op.profile_image,
      rating: op.rating,
      total_missions: op.total_missions || 0,
      completed_missions: op.completed_missions || 0,
      total_earned: op.total_earned || 0,
      member_since: op.member_since,
      flight_hours: op.flight_hours || 0,
      drone_fleet: op.drone_fleet || [],
      license_status: op.license_status || 'none',
    };
  },

  getEnterpriseProfile(enterpriseId) {
    const ent = this.getEnterpriseById(enterpriseId);
    if (!ent) return null;
    const total = db.prepare('SELECT COUNT(*) AS n FROM missions WHERE enterprise_id = ?').get(enterpriseId).n;
    const done  = db.prepare(`SELECT COUNT(*) AS n FROM missions WHERE enterprise_id = ? AND status = 'completed'`).get(enterpriseId).n;
    return {
      id: ent.id,
      company_name: ent.company_name,
      industry: ent.industry,
      bio: ent.bio || null,
      description: ent.description,
      website: ent.website,
      logo_url: ent.logo_url || null,
      operating_regions: ent.operating_regions,
      business_verified: !!ent.business_verified,
      created_at: ent.created_at,
      total_missions_posted: total,
      total_missions_completed: done,
    };
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  updateOperatorProfile(operatorId, updates) {
    const allowed = ['full_name', 'username', 'region', 'drone_model', 'vehicle_type',
      'experience', 'certifications', 'profile_image', 'drone_image', 'flight_stack',
      'autopilot_hardware', 'firmware_version', 'communication_protocol', 'contact_email',
      'bio', 'flight_hours', 'drone_fleet', 'license_document_url', 'license_status'];
    const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
    return this.updateOperator(operatorId, safe);
  },

  updateEnterpriseProfile(enterpriseId, updates) {
    const allowed = ['company_name', 'contact_name', 'contact_email', 'contact_phone',
      'industry', 'description', 'website', 'operating_regions', 'business_type', 'bio', 'logo_url'];
    const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
    return this.updateEnterprise(enterpriseId, safe);
  },

  // ── Audit logging ──────────────────────────────────────────────────────────
  addAuditLog(action, userId, details = {}) {
    db.prepare(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_id, payload, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      randomUUID(),
      details.entity_type ?? null,
      details.entity_id ?? null,
      action,
      userId ?? null,
      JSON.stringify(details),
      Date.now(),
    );
  },

  // ── Admin ──────────────────────────────────────────────────────────────────
  clearAll() {
    db.exec(`
      DELETE FROM conv_messages;
      DELETE FROM conversations;
      DELETE FROM messages;
      DELETE FROM ratings;
      DELETE FROM disputes;
      DELETE FROM operator_stakes;
      DELETE FROM mission_slots;
      DELETE FROM contracts;
      DELETE FROM applications;
      DELETE FROM missions;
      DELETE FROM enterprises;
      DELETE FROM operators;
      DELETE FROM audit_logs;
    `);
    return true;
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// Phase 4 helpers — slots, stakes, disputes, audit logs
// ═════════════════════════════════════════════════════════════════════════════

export const slotHelpers = {
  // Bulk-create slots for a mission. Returns the inserted rows.
  // `requirements` is the per-slot requirements object (or null to inherit
  // from the mission level).
  createSlotsForMission(missionId, count, requirements = null) {
    if (!count || count < 1) return [];
    const stmt = db.prepare(`INSERT INTO mission_slots (id, mission_id, slot_index, status, requirements)
      VALUES (?, ?, ?, 'open', ?)`);
    const tx = db.transaction(() => {
      const rows = [];
      for (let i = 0; i < count; i++) {
        const id = randomUUID();
        stmt.run(id, missionId, i, requirements ? JSON.stringify(requirements) : '{}');
        rows.push({ id, mission_id: missionId, slot_index: i, status: 'open' });
      }
      return rows;
    });
    return tx();
  },

  getSlotsByMission(missionId) {
    return db.prepare(`SELECT s.*,
        o.username AS operator_username,
        o.full_name AS operator_full_name
      FROM mission_slots s
      LEFT JOIN operators o ON o.id = s.operator_id
      WHERE s.mission_id = ?
      ORDER BY s.slot_index ASC`).all(missionId).map(r => ({
        ...r,
        requirements: parseJSON(r.requirements, {}),
      }));
  },

  getSlotById(id) {
    const row = db.prepare('SELECT * FROM mission_slots WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, requirements: parseJSON(row.requirements, {}) };
  },

  // Atomic claim: succeeds only if slot is 'open' and operator hasn't claimed
  // another slot on the same mission. Returns the updated slot, or throws.
  claimSlot(slotId, operatorId) {
    return db.transaction(() => {
      const slot = this.getSlotById(slotId);
      if (!slot) throw new Error('Slot not found');
      if (slot.status !== 'open') throw new Error(`Slot is not open (current status: ${slot.status})`);

      const dup = db.prepare(`SELECT 1 FROM mission_slots WHERE mission_id = ? AND operator_id = ? LIMIT 1`)
        .get(slot.mission_id, operatorId);
      if (dup) throw new Error('Operator already claimed a slot on this mission');

      db.prepare(`UPDATE mission_slots SET operator_id = ?, status = 'claimed', claimed_at = ? WHERE id = ?`)
        .run(operatorId, Date.now(), slotId);

      return this.getSlotById(slotId);
    })();
  },

  // Operator marks slot active (ready to start work).
  activateSlot(slotId, operatorId) {
    return db.transaction(() => {
      const slot = this.getSlotById(slotId);
      if (!slot) throw new Error('Slot not found');
      if (slot.operator_id !== operatorId) throw new Error('Not your slot');
      if (slot.status !== 'claimed') throw new Error(`Slot must be claimed (current: ${slot.status})`);
      db.prepare(`UPDATE mission_slots SET status = 'active' WHERE id = ?`).run(slotId);
      return this.getSlotById(slotId);
    })();
  },

  completeSlot(slotId, operatorId) {
    return db.transaction(() => {
      const slot = this.getSlotById(slotId);
      if (!slot) throw new Error('Slot not found');
      if (slot.operator_id !== operatorId) throw new Error('Not your slot');
      if (!['active', 'claimed'].includes(slot.status)) {
        throw new Error(`Slot must be active or claimed (current: ${slot.status})`);
      }
      db.prepare(`UPDATE mission_slots SET status = 'completed', completed_at = ? WHERE id = ?`)
        .run(Date.now(), slotId);
      return this.getSlotById(slotId);
    })();
  },

  // After a slot transition, returns counts so the caller can decide the
  // mission's overall status (open vs partially_filled vs fully_staffed).
  countSlotStatuses(missionId) {
    const rows = db.prepare(`SELECT status, COUNT(*) as n FROM mission_slots WHERE mission_id = ? GROUP BY status`).all(missionId);
    const counts = { open: 0, claimed: 0, active: 0, completed: 0, failed: 0 };
    for (const r of rows) counts[r.status] = r.n;
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
    return counts;
  },
};

export const stakeHelpers = {
  lockStake(operatorId, missionId, lamports) {
    const id = randomUUID();
    db.prepare(`INSERT INTO operator_stakes (id, operator_id, mission_id, amount_lamports, status, locked_at)
      VALUES (?, ?, ?, ?, 'locked', ?)`).run(id, operatorId, missionId, lamports, Date.now());
    return this.getStakeById(id);
  },

  getStakeById(id) {
    return db.prepare('SELECT * FROM operator_stakes WHERE id = ?').get(id) || null;
  },

  getStakesByMission(missionId) {
    return db.prepare('SELECT * FROM operator_stakes WHERE mission_id = ?').all(missionId);
  },

  getStakesByOperator(operatorId) {
    return db.prepare('SELECT * FROM operator_stakes WHERE operator_id = ? ORDER BY locked_at DESC').all(operatorId);
  },

  releaseStake(stakeId, settleTx = null) {
    db.prepare(`UPDATE operator_stakes SET status = 'released', settled_at = ?, settle_tx = ? WHERE id = ?`)
      .run(Date.now(), settleTx, stakeId);
    return this.getStakeById(stakeId);
  },

  slashStake(stakeId, settleTx = null) {
    db.prepare(`UPDATE operator_stakes SET status = 'slashed', settled_at = ?, settle_tx = ? WHERE id = ?`)
      .run(Date.now(), settleTx, stakeId);
    return this.getStakeById(stakeId);
  },

  // For reputation scoring — counts how many stakes have ever been slashed/released.
  getStakeCounts(operatorId) {
    const rows = db.prepare(`SELECT status, COUNT(*) as n FROM operator_stakes WHERE operator_id = ? GROUP BY status`).all(operatorId);
    const counts = { locked: 0, released: 0, slashed: 0 };
    for (const r of rows) counts[r.status] = r.n;
    return counts;
  },
};

export const disputeHelpers = {
  createDispute(data) {
    const id = randomUUID();
    db.prepare(`INSERT INTO disputes (id, contract_id, raised_by_role, raised_by_id, reason, evidence, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`).run(
      id, data.contract_id, data.raised_by_role, data.raised_by_id,
      data.reason || null, JSON.stringify(data.evidence || []), Date.now(),
    );
    return this.getDisputeById(id);
  },

  getDisputeById(id) {
    const row = db.prepare('SELECT * FROM disputes WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, evidence: parseJSON(row.evidence, []) };
  },

  getDisputesByContract(contractId) {
    return db.prepare('SELECT * FROM disputes WHERE contract_id = ? ORDER BY created_at DESC').all(contractId)
      .map(r => ({ ...r, evidence: parseJSON(r.evidence, []) }));
  },

  getOpenDisputes() {
    return db.prepare(`SELECT * FROM disputes WHERE status = 'open' ORDER BY created_at DESC`).all()
      .map(r => ({ ...r, evidence: parseJSON(r.evidence, []) }));
  },

  resolveDispute(disputeId, resolution, resolvedStatus = 'resolved') {
    db.prepare(`UPDATE disputes SET status = ?, resolution = ?, resolved_at = ? WHERE id = ?`)
      .run(resolvedStatus, resolution, Date.now(), disputeId);
    return this.getDisputeById(disputeId);
  },
};

export const experienceHelpers = {
  createExperience(operatorId, data) {
    const id = randomUUID();
    db.prepare(`INSERT INTO operator_experiences
      (id, operator_id, company, role, region, industry, start_date, end_date,
       description, drone_models, image_url, enterprise_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, operatorId,
      data.company, data.role,
      data.region ?? null, data.industry ?? null,
      data.start_date ?? null, data.end_date ?? null,
      data.description ?? null,
      JSON.stringify(data.drone_models || []),
      data.image_url ?? null,
      data.enterprise_id ?? null,
      Date.now(),
    );
    return this.getExperienceById(id);
  },

  getExperienceById(id) {
    const row = db.prepare('SELECT * FROM operator_experiences WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, drone_models: parseJSON(row.drone_models, []) };
  },

  getExperiencesByOperator(operatorId) {
    return db.prepare(`SELECT * FROM operator_experiences
      WHERE operator_id = ?
      ORDER BY (end_date IS NULL) DESC, end_date DESC, start_date DESC`).all(operatorId)
      .map(r => ({ ...r, drone_models: parseJSON(r.drone_models, []) }));
  },

  updateExperience(id, updates) {
    const existing = this.getExperienceById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    db.prepare(`UPDATE operator_experiences SET
      company=@company, role=@role, region=@region, industry=@industry,
      start_date=@start_date, end_date=@end_date,
      description=@description, drone_models=@drone_models,
      image_url=@image_url, enterprise_id=@enterprise_id
      WHERE id=@id`).run({
      id,
      company: merged.company,
      role: merged.role,
      region: merged.region ?? null,
      industry: merged.industry ?? null,
      start_date: merged.start_date ?? null,
      end_date: merged.end_date ?? null,
      description: merged.description ?? null,
      drone_models: JSON.stringify(merged.drone_models || []),
      image_url: merged.image_url ?? null,
      enterprise_id: merged.enterprise_id ?? null,
    });
    return this.getExperienceById(id);
  },

  deleteExperience(id) {
    db.prepare('DELETE FROM operator_experiences WHERE id = ?').run(id);
    return true;
  },
};

// ─── Operator search — used by enterprises browsing the marketplace ──────────
// Filters: region (substring), cert (must contain), vehicle_type, min_rating,
// min_hours, license_status. Returns public-shape operator rows ordered by
// rating desc.
export const searchHelpers = {
  searchOperators(filters = {}) {
    const where = [];
    const params = {};
    if (filters.region)        { where.push('LOWER(region) LIKE @region'); params.region = `%${String(filters.region).toLowerCase()}%`; }
    if (filters.vehicle_type)  { where.push('LOWER(vehicle_type) = @vehicle_type'); params.vehicle_type = String(filters.vehicle_type).toLowerCase(); }
    if (filters.min_rating)    { where.push('(rating IS NOT NULL AND rating >= @min_rating)'); params.min_rating = parseFloat(filters.min_rating); }
    if (filters.min_hours)     { where.push('(flight_hours >= @min_hours)'); params.min_hours = parseInt(filters.min_hours, 10); }
    if (filters.license_status){ where.push('license_status = @license_status'); params.license_status = filters.license_status; }
    const sql = `SELECT * FROM operators
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY (rating IS NULL) ASC, rating DESC, completed_missions DESC
      LIMIT 200`;
    const rows = db.prepare(sql).all(params).map(r => deserializeRow('operators', r));
    // Optional cert filter applied in JS (JSON array stored as TEXT)
    if (filters.cert) {
      const needle = String(filters.cert).toLowerCase();
      return rows.filter(o => (o.certifications || []).some(c => String(c).toLowerCase() === needle));
    }
    return rows;
  },

  searchEnterprises(filters = {}) {
    const where = [];
    const params = {};
    if (filters.industry)          { where.push('LOWER(industry) = @industry'); params.industry = String(filters.industry).toLowerCase(); }
    if (filters.region)            { where.push('LOWER(operating_regions) LIKE @region'); params.region = `%${String(filters.region).toLowerCase()}%`; }
    if (filters.verified === true) { where.push('business_verified = 1'); }
    const sql = `SELECT * FROM enterprises
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY total_missions_posted DESC
      LIMIT 200`;
    return db.prepare(sql).all(params).map(r => deserializeRow('enterprises', r));
  },
};

export const auditHelpers = {
  // Append-only event log. Cheap to call; powers timeline UIs and proofs.
  log({ entity_type, entity_id, action, actor_id, actor_role, payload }) {
    db.prepare(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_id, actor_role, payload, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      randomUUID(),
      entity_type || null,
      entity_id || null,
      action,
      actor_id || null,
      actor_role || null,
      payload ? JSON.stringify(payload) : null,
      Date.now(),
    );
  },

  getByEntity(entityType, entityId, limit = 100) {
    return db.prepare(`SELECT * FROM audit_logs
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY timestamp DESC LIMIT ?`).all(entityType, entityId, limit)
      .map(r => ({ ...r, payload: parseJSON(r.payload, null) }));
  },

  getByActor(actorId, limit = 200) {
    return db.prepare(`SELECT * FROM audit_logs WHERE actor_id = ? ORDER BY timestamp DESC LIMIT ?`).all(actorId, limit)
      .map(r => ({ ...r, payload: parseJSON(r.payload, null) }));
  },
};

// Legacy shim — keeps any stray db.prepare() calls from crashing at import.
export { db };

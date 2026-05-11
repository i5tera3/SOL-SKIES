// server/schemas.mjs
// Centralized request validation schemas using zod.
//
// Usage:
//   import { validate } from './schemas.mjs';
//   import { createMissionSchema } from './schemas.mjs';
//   app.post('/api/missions', requireAuth, validate(createMissionSchema), handler);
//
// Validation runs BEFORE the route handler. On failure: 400 with a structured
// error body that the frontend can render. On success: req.body / req.params /
// req.query are replaced with the parsed (and coerced) data.

import { z } from 'zod';

// ─── Primitive shapes shared across schemas ──────────────────────────────────
const SolanaAddress = z.string().min(32).max(44).regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid base58 wallet address');
const Uuid = z.string().uuid();
const Username = z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, 'Letters, digits, dot, dash, underscore only');
const ShortText = z.string().min(1).max(200);
const LongText = z.string().min(1).max(5000);
const Url = z.string().url().max(500);
const Email = z.string().email().max(120);
const Phone = z.string().min(5).max(30);
const SolAmount = z.coerce.number().positive().max(10_000); // sane upper bound for devnet
const RatingScale = z.coerce.number().min(1).max(5);
const Latitude = z.coerce.number().min(-90).max(90);
const Longitude = z.coerce.number().min(-180).max(180);
const Year = z.coerce.number().int().min(1800).max(2100);
const Bs58Signature = z.string().min(80).max(100); // 64-byte sig in base58 ~= 87-88 chars
const NonceHex = z.string().regex(/^[0-9a-f]+$/i).length(32); // 16 bytes hex

// Drone-domain enums — accept the values that already exist in db.json plus
// known industry standards. Loose enough to not break legacy data.
const FlightStack = z.enum(['px4', 'ardupilot', 'betaflight', 'inav', 'other']);
const VehicleType = z.enum(['multicopter', 'quad', 'hex', 'octo', 'fixed_wing', 'vtol', 'helicopter', 'other']);
const Experience = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);
const MissionStatus = z.enum(['draft', 'open', 'assigned', 'active', 'submitted', 'completed', 'cancelled', 'disputed']);
const ApplicationStatus = z.enum(['pending', 'approved', 'rejected']);
const ContractStatus = z.enum(['active', 'completed', 'cancelled', 'disputed']);
const Role = z.enum(['operator', 'enterprise']);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const walletChallengeSchema = z.object({
  walletAddress: SolanaAddress,
});

export const walletLoginSchema = z.object({
  walletAddress: SolanaAddress,
  signature: Bs58Signature,
  nonce: NonceHex,
});

// ─── Operator signup ─────────────────────────────────────────────────────────
const FileRef = z.object({
  name: z.string().min(1).max(255),
  url: z.string().min(1).max(1000),
  type: z.string().min(1).max(100),
});

export const createOperatorSchema = z.object({
  wallet_address: SolanaAddress,
  signature: Bs58Signature,
  nonce: NonceHex,
  full_name: z.string().min(1).max(120),
  username: Username,
  region: z.string().max(120).optional().nullable(),
  drone_model: z.string().max(120).optional().nullable(),
  drone_image: z.string().max(1000).optional().nullable(),
  flight_stack: FlightStack.optional().nullable(),
  autopilot_hardware: z.string().max(120).optional().nullable(),
  vehicle_type: VehicleType.optional().nullable(),
  firmware_version: z.string().max(40).optional().nullable(),
  communication_protocol: z.string().max(40).optional().default('mavlink'),
  experience: Experience.optional().nullable(),
  certifications: z.array(z.string().max(60)).max(20).optional().default([]),
  certification_files: z.array(FileRef).max(20).optional().default([]),
  bio: z.string().max(2000).optional().nullable(),
  flight_hours: z.coerce.number().int().min(0).max(100_000).optional().default(0),
  drone_fleet: z.array(z.object({
    model: z.string().max(120),
    image: z.string().max(1000).optional().nullable(),
    specs: z.string().max(2000).optional().nullable(),
  })).max(20).optional().default([]),
});

export const updateOperatorSchema = createOperatorSchema
  .omit({ wallet_address: true, signature: true, nonce: true, username: true })
  .partial();

// ─── Enterprise signup ───────────────────────────────────────────────────────
export const createEnterpriseSchema = z.object({
  wallet_address: SolanaAddress,
  signature: Bs58Signature,
  nonce: NonceHex,
  company_name: z.string().min(1).max(160),
  business_type: z.string().max(60).optional().nullable(),
  year_established: Year.optional().nullable(),
  industry: z.string().max(60).optional().nullable(),
  operating_regions: z.string().max(500).optional().nullable(),
  contact_name: z.string().min(1).max(120),
  contact_email: Email,
  contact_phone: Phone.optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  business_certificate_url: z.string().max(1000).optional().nullable(),
  business_document_url: z.string().max(1000).optional().nullable(),
  business_verified: z.boolean().optional().default(false),
});

export const updateEnterpriseSchema = createEnterpriseSchema
  .omit({ wallet_address: true, signature: true, nonce: true })
  .partial();

// ─── Missions ────────────────────────────────────────────────────────────────
// The legacy create-mission form sends `name` per subtask; the Phase-4 spec
// uses `title`. Accept either. Everything else is best-effort — passthrough
// keeps the dashboard's extra fields (sol_reward, claimed_by, status, etc.)
// intact so they round-trip through the API unchanged.
const SubtaskRequirement = z.object({
  id:    z.string().max(64).optional(),
  title: z.string().min(1).max(200).optional(),
  name:  z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  required_certifications: z.array(z.string().max(60)).max(10).optional().default([]),
  required_min_hours: z.coerce.number().int().min(0).max(100_000).optional().default(0),
  required_vehicle_types: z.array(VehicleType).max(10).optional().default([]),
  required_payload: z.array(z.string().max(60)).max(10).optional().default([]),
}).passthrough().refine(d => !!(d.title || d.name), {
  message: 'Each subtask needs a title or name',
  path: ['name'],
});

// Treat empty strings as null/undefined for nullable text fields. The
// EnterpriseDashboard form initializes lat/lng/region etc. to '' rather than
// null, and z.coerce.number() turns '' into 0 — which then passes range
// validation but stamps phantom coordinates onto the mission. Pre-process.
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);
const OptionalNumber = z.preprocess(emptyToNull, z.coerce.number().nullable().optional());
const OptionalLat    = z.preprocess(emptyToNull, z.coerce.number().min(-90).max(90).nullable().optional());
const OptionalLng    = z.preprocess(emptyToNull, z.coerce.number().min(-180).max(180).nullable().optional());

// Plain ZodObject — `.partial()` and `.transform()` both apply, but only one
// at a time can be on the same instance. So we keep the base object and derive
// `createMissionSchema` (with the legacy-field normalizer transform) and
// `updateMissionSchema` (a partial of the base, no transform) from it.
const missionFields = z.object({
  enterprise_id: Uuid.optional(),
  enterprise_name: z.string().max(160).optional().nullable(),
  title: z.string().min(1).max(200),
  // Accept either snake_case or the legacy camelCase. They mean the same thing.
  mission_type: z.string().max(60).optional().nullable(),
  missionType:  z.string().max(60).optional().nullable(),
  region: z.string().max(120).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  latitude:  OptionalLat,
  longitude: OptionalLng,
  description: z.string().max(5000).optional().nullable(),
  reward: SolAmount,
  status: MissionStatus.optional().default('open'),
  required_certifications: z.array(z.string().max(60)).max(10).optional().default([]),
  required_min_hours: z.coerce.number().int().min(0).max(100_000).optional().default(0),
  required_vehicle_types: z.array(VehicleType).max(10).optional().default([]),
  required_payload: z.array(z.string().max(60)).max(10).optional().default([]),
  required_operators: z.coerce.number().int().min(1).max(100).optional().default(1),
  // Legacy form fields the dashboard still sends — accept silently so the
  // form doesn't 400 on every submit.
  operators_needed: z.coerce.number().int().min(1).max(100).optional(),
  requirements: z.record(z.any()).optional(),
  escrow_status: z.string().max(40).optional(),
  created_at: z.coerce.number().optional(),
  subtasks: z.array(SubtaskRequirement).max(50).optional().default([]),
  start_date: z.string().max(40).optional().nullable(),
  end_date: z.string().max(40).optional().nullable(),
});

export const createMissionSchema = missionFields.transform((data) => {
  // Normalize legacy camelCase → snake_case so downstream code sees one shape.
  if (!data.mission_type && data.missionType) data.mission_type = data.missionType;
  delete data.missionType;
  if (data.operators_needed && data.required_operators === 1) {
    data.required_operators = data.operators_needed;
  }
  return data;
});

export const updateMissionSchema = missionFields.partial();

export const updateMissionDatesSchema = z.object({
  start_date: z.string().max(40).optional().nullable(),
  end_date: z.string().max(40).optional().nullable(),
});

// ─── Applications ────────────────────────────────────────────────────────────
export const createApplicationSchema = z.object({
  mission_id: Uuid,
  operator_id: Uuid.optional(), // server overwrites with JWT sub
  operator_name: z.string().max(120).optional().nullable(),
  operator_username: Username.optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  proposed_subtask_id: z.string().max(64).optional().nullable(),
});

export const updateApplicationSchema = z.object({
  status: ApplicationStatus,
});

// ─── Contracts ───────────────────────────────────────────────────────────────
export const completeContractSchema = z.object({
  rating: RatingScale,
  comment: z.string().max(2000).optional().nullable(),
});

export const updateContractSchema = z.object({
  status: ContractStatus.optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
}).passthrough(); // allow other fields the dashboard already sends

// ─── Deposits / withdrawals ──────────────────────────────────────────────────
export const depositSchema = z.object({
  enterpriseId: Uuid,
  amount: z.coerce.number().positive().max(1_000_000),
});

export const withdrawSchema = z.object({
  amount: z.coerce.number().positive().max(10_000),
});

// ─── Escrow (on-chain) ───────────────────────────────────────────────────────
const TxSignature = z.string().min(64).max(100); // base58 tx sig
export const verifyDepositSchema = z.object({
  txSignature: TxSignature,
  missionId: Uuid,
  expectedSol: SolAmount,
});

// ─── Messages / conversations ────────────────────────────────────────────────
// Accepts either `text` (legacy field name used by the dashboards) or `message`.
// At least one must be present and non-empty.
export const createMessageSchema = z.object({
  contract_id: Uuid,
  sender_type: z.enum(['operator', 'enterprise']).optional(),
  text:    z.string().min(1).max(2000).optional(),
  message: z.string().min(1).max(2000).optional(),
}).refine(d => !!(d.text || d.message), {
  message: 'Either `text` or `message` is required',
  path: ['text'],
});

export const createConversationSchema = z.object({
  operator_id: Uuid,
  enterprise_id: Uuid,
  contract_id: Uuid.nullable().optional(),
});

export const sendConvMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

// ─── Subtasks ────────────────────────────────────────────────────────────────
export const claimSubtaskSchema = z.object({
  operator_name: z.string().max(120).optional().nullable(),
});

// ─── Admin verification ──────────────────────────────────────────────────────
export const verifyOperatorSchema = z.object({
  status: z.enum(['verified', 'rejected']),
});

// ─── Phase 4: slots, stakes, disputes ────────────────────────────────────────
export const claimSlotSchema = z.object({
  // operator_id is taken from JWT — the body just needs a stake amount in lamports.
  stake_lamports: z.coerce.number().int().min(0).max(10_000_000_000).optional().default(0),
});

export const completeSlotSchema = z.object({
  // No body required; auth + slot ownership do the work.
}).passthrough();

export const raiseDisputeSchema = z.object({
  reason: z.string().min(10).max(2000),
  evidence: z.array(z.object({
    url: z.string().min(1).max(1000),
    type: z.string().max(100),
    note: z.string().max(500).optional(),
  })).max(20).optional().default([]),
});

export const resolveDisputeSchema = z.object({
  decision: z.enum(['operator_wins', 'enterprise_wins', 'split', 'dismiss']),
  resolution_note: z.string().min(1).max(2000),
});

// ─── Operator work experiences ───────────────────────────────────────────────
export const createExperienceSchema = z.object({
  company:       z.string().min(1).max(160),
  role:          z.string().min(1).max(120),
  region:        z.string().max(120).optional().nullable(),
  industry:      z.string().max(80).optional().nullable(),
  start_date:    z.string().max(20).optional().nullable(),
  end_date:      z.string().max(20).optional().nullable(),
  description:   z.string().max(3000).optional().nullable(),
  drone_models:  z.array(z.string().max(120)).max(20).optional().default([]),
  image_url:     z.string().max(1000).optional().nullable(),
  enterprise_id: z.string().uuid().optional().nullable(),
});

export const updateExperienceSchema = createExperienceSchema.partial();

export const transitionMissionSchema = z.object({
  to: z.enum(['draft', 'funded', 'open', 'partially_filled', 'fully_staffed',
              'active', 'submitted', 'completed', 'disputed', 'cancelled']),
  payload: z.record(z.any()).optional(),
});

// ─── Settings updates ────────────────────────────────────────────────────────
export const updateOperatorSettingsSchema = updateOperatorSchema;
export const updateEnterpriseSettingsSchema = updateEnterpriseSchema;

// ─── Middleware factory ──────────────────────────────────────────────────────
// Validates req.body by default. Pass { source: 'query' | 'params' } to validate
// query strings or path params instead. Numeric coercion happens automatically
// for query params (zod's .coerce handles `?amount=5` → number 5).
export function validate(schema, options = {}) {
  const source = options.source || 'body';
  return (req, res, next) => {
    const data = req[source];
    const result = schema.safeParse(data);
    if (!result.success) {
      const issues = result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      return res.status(400).json({
        error: 'Validation failed',
        field: issues[0]?.path,
        message: issues[0]?.message,
        issues,
      });
    }
    req[source] = result.data;
    next();
  };
}

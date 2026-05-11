// server/index.mjs
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';          // FIX: was missing, crashed /api/missions
import {
  dbHelpers,
  slotHelpers,
  stakeHelpers,
  disputeHelpers,
  auditHelpers,
  experienceHelpers,
  searchHelpers,
} from './database.mjs';
import {
  generateChallenge,
  verifyChallenge,
  signToken,
  requireAuth,
  requireRole,
} from './auth.mjs';
import { canTransition, assertTransition, FSMError, MISSION_TRANSITIONS } from './missionFSM.mjs';
import { evaluateEligibility } from './eligibility.mjs';
import { computeReputationScore, computeMissionRisk } from './reputation.mjs';
import { seedDemoData } from './seed.mjs';
import {
  validate,
  walletChallengeSchema,
  walletLoginSchema,
  createOperatorSchema,
  updateOperatorSchema,
  createEnterpriseSchema,
  updateEnterpriseSchema,
  createMissionSchema,
  updateMissionSchema,
  updateMissionDatesSchema,
  createApplicationSchema,
  updateApplicationSchema,
  completeContractSchema,
  updateContractSchema,
  depositSchema,
  withdrawSchema,
  verifyDepositSchema,
  createMessageSchema,
  createConversationSchema,
  sendConvMessageSchema,
  claimSubtaskSchema,
  verifyOperatorSchema,
  updateOperatorSettingsSchema,
  updateEnterpriseSettingsSchema,
  claimSlotSchema,
  raiseDisputeSchema,
  resolveDisputeSchema,
  transitionMissionSchema,
  createExperienceSchema,
  updateExperienceSchema,
} from './schemas.mjs';
// Escrow helpers — loaded dynamically so server still boots if @solana/web3.js
// isn't installed yet (run `npm install` to enable on-chain features).
let ESCROW_ADDRESS = 'Dx9ey3aYGcpJn1XWNBknC2BvGBpS9TwGAWpRkFGTFf1m';
let getEscrowBalance = async () => ({ sol: 0, lamports: 0 });
let verifyDeposit    = async () => ({ ok: false, reason: 'escrow module not loaded' });
let payOperator      = async () => ({ ok: false, reason: 'escrow module not loaded' });
let solToLamports    = (sol) => Math.round(parseFloat(sol) * 1e9);
let ensureEscrowFunded = async () => null;

try {
  const escrow = await import('./escrow.mjs');
  ESCROW_ADDRESS     = escrow.ESCROW_ADDRESS;
  getEscrowBalance   = escrow.getEscrowBalance;
  verifyDeposit      = escrow.verifyDeposit;
  payOperator        = escrow.payOperator;
  solToLamports      = escrow.solToLamports;
  ensureEscrowFunded = escrow.ensureEscrowFunded;
  console.log('✅ Escrow module loaded. Address:', ESCROW_ADDRESS);
} catch (e) {
  console.warn('⚠️  Escrow module failed to load — on-chain features disabled.');
  console.warn('    Run `npm install` to enable real Solana devnet escrow.');
  console.warn('    Error:', e.message);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// CORS — locked to FRONTEND_URL in prod, wide-open in dev.
if (process.env.FRONTEND_URL) {
  const allowed = process.env.FRONTEND_URL.split(',').map(s => s.trim());
  app.use(cors({ origin: allowed, credentials: true }));
} else {
  app.use(cors());
}
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── File uploads ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads/')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ── File upload ───────────────────────────────────────────────────────────────
// Builds the served URL from the inbound request so the same endpoint works on
// localhost, staging, and prod without code changes.
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${base}/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH — challenge → sign → verify → JWT
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: shape a user record + role for JWT payload + client response.
function userWithRole(user) {
  if (!user) return null;
  // simple-db.findUserByWallet should already attach a role; defend if not.
  const role = user.role || (user.company_name ? 'enterprise' : 'operator');
  return { ...user, role };
}

// Public: does this wallet have an account? Used by Home.jsx to decide
// "show sign-in flow" vs "redirect to /signup". Does NOT issue a session.
app.get('/api/auth/wallet-check', (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const user = userWithRole(dbHelpers.findUserByWallet(wallet));
    if (user) return res.json({ exists: true, user });
    res.json({ exists: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Public: issue a one-time nonce + the message the wallet should sign.
app.post('/api/auth/wallet-challenge', validate(walletChallengeSchema), (req, res) => {
  try {
    const { walletAddress } = req.body;
    const challenge = generateChallenge(walletAddress);
    res.json(challenge);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Public: verify signature against active nonce; if valid, issue a JWT.
app.post('/api/auth/wallet-login', validate(walletLoginSchema), (req, res) => {
  try {
    const { walletAddress, signature, nonce } = req.body;
    const result = verifyChallenge(walletAddress, signature, nonce);
    if (!result.ok) return res.status(401).json({ error: result.reason });

    const user = userWithRole(dbHelpers.findUserByWallet(walletAddress));
    if (!user) return res.status(404).json({ error: 'Wallet not registered' });

    const token = signToken({ sub: user.id, wallet: walletAddress, role: user.role });
    res.json({ success: true, user, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Authed: return the current user from a valid JWT. Used by sessionContext on
// page load to validate the cached token and refresh user data.
app.get('/api/auth/me', requireAuth, (req, res) => {
  try {
    const user = userWithRole(dbHelpers.findUserByWallet(req.user.wallet));
    if (!user) return res.status(404).json({ error: 'User no longer exists' });
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Authed: explicit logout. Stateless JWTs can't be "revoked" without a blacklist,
// but the client should drop the token. This endpoint exists for symmetry +
// audit logging once that's wired up.
app.post('/api/auth/logout', requireAuth, (req, res) => {
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AVAILABILITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

// FIX: was using db.prepare stub → always returned available:true
app.get('/api/check/username', (req, res) => {
  try {
    const { username } = req.query;
    res.json({ available: dbHelpers.checkUsername(username) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/check/company', (req, res) => {
  try {
    const { name } = req.query;
    res.json({ available: dbHelpers.checkCompanyName(name) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/check/wallet', (req, res) => {
  try {
    const { wallet } = req.query;
    res.json({ available: dbHelpers.checkWallet(wallet) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATORS
// ═══════════════════════════════════════════════════════════════════════════════

// Signup endpoint — verifies the wallet signature against an active nonce,
// creates the operator record, and issues a JWT in one step.
app.post('/api/operators', validate(createOperatorSchema), (req, res) => {
  try {
    const { signature, nonce, ...data } = req.body;
    const wallet = data.wallet_address;
    const v = verifyChallenge(wallet, signature, nonce);
    if (!v.ok) return res.status(401).json({ error: v.reason });

    const operator = dbHelpers.createOperator(data);
    const token = signToken({ sub: operator.id, wallet, role: 'operator' });
    res.json({ ...operator, role: 'operator', token });
  } catch (e) {
    console.error('Error creating operator:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/operators/wallet/:wallet', (req, res) => {
  try {
    const operator = dbHelpers.getOperatorByWallet(req.params.wallet);
    if (!operator) return res.status(404).json({ error: 'Operator not found' });
    res.json(operator);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FIX: was using db.prepare stub → dashboard always returned null
app.get('/api/operators/:id/dashboard', (req, res) => {
  try {
    const dashboard = dbHelpers.getOperatorDashboard(req.params.id);
    if (!dashboard) return res.status(404).json({ error: 'Operator not found' });
    res.json(dashboard);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/operators/:id', (req, res) => {
  try {
    const operator = dbHelpers.getOperatorById(req.params.id);
    if (!operator) return res.status(404).json({ error: 'Operator not found' });
    res.json(operator);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/operators/:id', requireAuth, validate(updateOperatorSchema), (req, res) => {
  try {
    if (req.user.sub !== req.params.id) {
      return res.status(403).json({ error: 'You can only update your own profile' });
    }
    const operator = dbHelpers.updateOperator(req.params.id, req.body);
    if (!operator) return res.status(404).json({ error: 'Operator not found' });
    res.json({ success: true, operator });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/operators/:id', requireAuth, (req, res) => {
  try {
    if (req.user.sub !== req.params.id) {
      return res.status(403).json({ error: 'You can only delete your own profile' });
    }
    dbHelpers.deleteOperator(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISES
// ═══════════════════════════════════════════════════════════════════════════════

// Signup endpoint — same pattern as /api/operators.
app.post('/api/enterprises', validate(createEnterpriseSchema), (req, res) => {
  try {
    const { signature, nonce, ...data } = req.body;
    const wallet = data.wallet_address;
    const v = verifyChallenge(wallet, signature, nonce);
    if (!v.ok) return res.status(401).json({ error: v.reason });

    const enterprise = dbHelpers.createEnterprise(data);
    const token = signToken({ sub: enterprise.id, wallet, role: 'enterprise' });
    res.json({ ...enterprise, role: 'enterprise', token });
  } catch (e) {
    console.error('Error creating enterprise:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/enterprises/wallet/:wallet', (req, res) => {
  try {
    const enterprise = dbHelpers.getEnterpriseByWallet(req.params.wallet);
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });
    res.json(enterprise);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FIX: was using db.prepare stub → always returned 404
app.get('/api/enterprises/:id', (req, res) => {
  try {
    const enterprise = dbHelpers.getEnterpriseById(req.params.id);
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });
    res.json(enterprise);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/enterprises/:id', requireAuth, validate(updateEnterpriseSchema), (req, res) => {
  try {
    if (req.user.sub !== req.params.id) {
      return res.status(403).json({ error: 'You can only update your own profile' });
    }
    const enterprise = dbHelpers.updateEnterprise(req.params.id, req.body);
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });
    res.json({ success: true, enterprise });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Deposit — only the enterprise itself can top up its own balance.
app.post('/api/deposit', requireAuth, requireRole('enterprise'), validate(depositSchema), (req, res) => {
  try {
    const { enterpriseId, amount } = req.body;
    if (req.user.sub !== enterpriseId) {
      return res.status(403).json({ error: 'You can only deposit to your own balance' });
    }
    const enterprise = dbHelpers.getEnterpriseById(enterpriseId);
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });
    const newBalance = (enterprise.usdc_balance || 0) + parseFloat(amount);
    dbHelpers.updateEnterprise(enterpriseId, { usdc_balance: newBalance });
    res.json({ success: true, balance: newBalance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Only enterprises can post missions, and only on their own behalf.
// If required_operators > 1, auto-creates that many slot rows so the multi-op
// flow is ready to claim against immediately.
app.post('/api/missions', requireAuth, requireRole('enterprise'), validate(createMissionSchema), (req, res) => {
  try {
    if (req.body.enterprise_id && req.body.enterprise_id !== req.user.sub) {
      return res.status(403).json({ error: 'enterprise_id must match the authenticated user' });
    }
    const data = { ...req.body, enterprise_id: req.user.sub };
    const mission = dbHelpers.createMission(data);

    // Deduct balance from enterprise.
    if (mission.enterprise_id && mission.reward) {
      const enterprise = dbHelpers.getEnterpriseById(mission.enterprise_id);
      if (enterprise) {
        const newBalance = Math.max(0, (enterprise.usdc_balance || 0) - mission.reward);
        dbHelpers.updateEnterprise(mission.enterprise_id, { usdc_balance: newBalance });
      }
    }

    // Auto-create slots for multi-operator missions.
    let slots = [];
    const requiredOps = mission.required_operators || mission.operators_needed || 1;
    if (requiredOps > 1) {
      slots = slotHelpers.createSlotsForMission(mission.id, requiredOps, {
        required_certifications: mission.required_certifications,
        required_min_hours:      mission.required_min_hours,
        required_vehicle_types:  mission.required_vehicle_types,
        required_payload:        mission.required_payload,
      });
    }

    auditHelpers.log({
      entity_type: 'mission', entity_id: mission.id, action: 'mission_created',
      actor_id: req.user.sub, actor_role: 'enterprise',
      payload: { reward: mission.reward, required_operators: requiredOps, slots_created: slots.length },
    });

    res.json({ ...mission, slots });
  } catch (e) {
    console.error('Error creating mission:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/missions', (req, res) => {
  try {
    const filters = {
      enterprise_id: req.query.enterprise_id,
      status: req.query.status,
      region: req.query.region
    };
    const missions = dbHelpers.getMissions(filters);
    res.json(missions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/missions/:id', (req, res) => {
  try {
    const mission = dbHelpers.getMissionById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    res.json(mission);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/missions/:id', requireAuth, validate(updateMissionSchema), (req, res) => {
  try {
    const existing = dbHelpers.getMissionById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Mission not found' });
    if (existing.enterprise_id !== req.user.sub) {
      return res.status(403).json({ error: 'Only the owning enterprise can edit this mission' });
    }
    // If a status change is requested, validate it through the FSM.
    if (req.body.status && req.body.status !== existing.status) {
      try {
        assertTransition(existing.status, req.body.status, 'enterprise');
      } catch (err) {
        if (err instanceof FSMError) return res.status(409).json({ error: err.message, code: err.code });
        throw err;
      }
      auditHelpers.log({
        entity_type: 'mission', entity_id: existing.id, action: 'mission_status_changed',
        actor_id: req.user.sub, actor_role: 'enterprise',
        payload: { from: existing.status, to: req.body.status },
      });
    }
    const mission = dbHelpers.updateMission(req.params.id, req.body);
    res.json(mission);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPLICATIONS (operator applies to mission)
// ═══════════════════════════════════════════════════════════════════════════════

// Operator applies to a mission — must be authenticated as the operator.
app.post('/api/applications', requireAuth, requireRole('operator'), validate(createApplicationSchema), (req, res) => {
  try {
    const { mission_id, operator_id } = req.body;
    if (operator_id && operator_id !== req.user.sub) {
      return res.status(403).json({ error: 'operator_id must match the authenticated user' });
    }
    const data = { ...req.body, operator_id: req.user.sub };
    if (dbHelpers.hasApplied(mission_id, req.user.sub)) {
      return res.status(409).json({ error: 'Already applied to this mission' });
    }
    const application = dbHelpers.createApplication(data);
    res.json(application);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Enterprise views applicants for their mission — must own the mission.
app.get('/api/missions/:id/applications', requireAuth, (req, res) => {
  try {
    const mission = dbHelpers.getMissionById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    if (mission.enterprise_id !== req.user.sub) {
      return res.status(403).json({ error: 'Only the owning enterprise can view applicants' });
    }
    const applications = dbHelpers.getApplicationsByMission(req.params.id);
    res.json(applications);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Operator views their own applications.
app.get('/api/operators/:id/applications', requireAuth, (req, res) => {
  try {
    if (req.user.sub !== req.params.id) {
      return res.status(403).json({ error: 'You can only view your own applications' });
    }
    const applications = dbHelpers.getApplicationsByOperator(req.params.id);
    res.json(applications);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Enterprise approves or rejects an application — must own the mission.
app.patch('/api/applications/:id', requireAuth, validate(updateApplicationSchema), (req, res) => {
  try {
    const { status } = req.body; // 'approved' | 'rejected'
    const existing = dbHelpers.getApplicationById?.(req.params.id);
    if (existing) {
      const mission = dbHelpers.getMissionById(existing.mission_id);
      if (!mission || mission.enterprise_id !== req.user.sub) {
        return res.status(403).json({ error: 'Only the owning enterprise can update this application' });
      }
    }
    const application = dbHelpers.updateApplication(req.params.id, { status });
    if (!application) return res.status(404).json({ error: 'Application not found' });

    // If approved, create a real contract
    if (status === 'approved') {
      const mission = dbHelpers.getMissionById(application.mission_id);
      if (mission) {
        // FIX: include operator_name + operator_username so dashboards can display them
        // without a second lookup, and so @username clickable chat links work.
        dbHelpers.createContract({
          mission_id: mission.id,
          enterprise_id: mission.enterprise_id,
          operator_id: application.operator_id,
          operator_name: application.operator_name || null,
          operator_username: application.operator_username || null,
          title: mission.title,
          description: mission.description,
          region: mission.region,
          amount_sol: mission.reward   // standardized field — reward → amount_sol
        });
        // Mark mission as assigned now that an operator is approved
        dbHelpers.updateMission(mission.id, { status: 'assigned' });
      }
    }

    res.json(application);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════════

// Listing contracts — must be a party to anything returned.
app.get('/api/contracts', requireAuth, (req, res) => {
  try {
    // Force the filter to constrain to the authenticated user, regardless of
    // what they sent in the query. Cross-user enumeration is blocked.
    const filter = req.user.role === 'enterprise'
      ? { enterprise_id: req.user.sub, status: req.query.status }
      : { operator_id: req.user.sub, status: req.query.status };
    const contracts = dbHelpers.getContracts(filter);
    res.json(contracts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Direct contract creation — restricted to enterprises. Note: contracts are
// normally created automatically when an application is approved.
app.post('/api/contracts', requireAuth, requireRole('enterprise'), (req, res) => {
  try {
    const data = { ...req.body, enterprise_id: req.user.sub };
    const contract = dbHelpers.createContract(data);
    res.json(contract);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/contracts/:id', requireAuth, validate(updateContractSchema), (req, res) => {
  try {
    const existing = dbHelpers.getContractById?.(req.params.id);
    if (existing) {
      const isParty =
        existing.enterprise_id === req.user.sub ||
        existing.operator_id === req.user.sub;
      if (!isParty) {
        return res.status(403).json({ error: 'Only contract parties can update this contract' });
      }
    }
    const contract = dbHelpers.updateContract(req.params.id, req.body);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES — now persisted to db.json, not localStorage
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: assert the authenticated user is a party to the given contract.
function isPartyToContract(req, contractId) {
  const c = dbHelpers.getContractById?.(contractId);
  if (!c) return false;
  return c.enterprise_id === req.user.sub || c.operator_id === req.user.sub;
}

app.get('/api/messages/:contractId', requireAuth, (req, res) => {
  try {
    if (!isPartyToContract(req, req.params.contractId)) {
      return res.status(403).json({ error: 'Not a party to this contract' });
    }
    const messages = dbHelpers.getMessages(req.params.contractId);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/messages', requireAuth, validate(createMessageSchema), (req, res) => {
  try {
    const { contract_id, sender_wallet } = req.body || {};
    if (!isPartyToContract(req, contract_id)) {
      return res.status(403).json({ error: 'Not a party to this contract' });
    }
    if (sender_wallet && sender_wallet !== req.user.wallet) {
      return res.status(403).json({ error: 'sender_wallet must match the authenticated user' });
    }
    const message = dbHelpers.createMessage({ ...req.body, sender_wallet: req.user.wallet });
    res.json(message);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/messages/:contractId/read', requireAuth, (req, res) => {
  try {
    if (!isPartyToContract(req, req.params.contractId)) {
      return res.status(403).json({ error: 'Not a party to this contract' });
    }
    dbHelpers.markMessagesRead(req.params.contractId, req.body.reader_type);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

// FIX: was using db.prepare stub → always returned []
app.get('/api/admin/operators', (req, res) => {
  try {
    res.json(dbHelpers.getAllOperators());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/enterprises', (req, res) => {
  try {
    res.json(dbHelpers.getAllEnterprises());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/operators/:wallet', (req, res) => {
  try {
    dbHelpers.deleteOperatorByWallet(req.params.wallet);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/enterprises/:wallet', (req, res) => {
  try {
    dbHelpers.deleteEnterpriseByWallet(req.params.wallet);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FIX: was using db.prepare stub → no-op
app.post('/api/admin/clear-all', (req, res) => {
  try {
    dbHelpers.clearAll();
    res.json({ success: true, message: 'All data cleared' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Debug — see raw db contents
app.get('/api/debug/db', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS & MESSAGING
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: is the user a party to this conversation?
function isPartyToConversation(req, conv) {
  if (!conv) return false;
  if (req.user.role === 'operator')   return conv.operator_id === req.user.sub;
  if (req.user.role === 'enterprise') return conv.enterprise_id === req.user.sub;
  return false;
}

// Get or create a conversation thread — requester must be one of the parties.
app.post('/api/conversations', requireAuth, validate(createConversationSchema), (req, res) => {
  try {
    const { operator_id, enterprise_id, contract_id } = req.body;
    if (!operator_id || !enterprise_id) return res.status(400).json({ error: 'operator_id and enterprise_id required' });
    const isParty =
      (req.user.role === 'operator'   && operator_id   === req.user.sub) ||
      (req.user.role === 'enterprise' && enterprise_id === req.user.sub);
    if (!isParty) return res.status(403).json({ error: 'You can only start conversations you are a party to' });
    const conv = dbHelpers.getOrCreateConversation(operator_id, enterprise_id, contract_id || null);
    res.json(conv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List conversations for the authenticated user (the user_id query is ignored —
// always derived from JWT to prevent cross-user enumeration).
app.get('/api/conversations', requireAuth, (req, res) => {
  try {
    const convs = dbHelpers.getConversationsByUser(req.user.sub, req.user.role);
    res.json(convs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/conversations/:id/messages', requireAuth, (req, res) => {
  try {
    const conv = dbHelpers.getConversationById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!isPartyToConversation(req, conv)) {
      return res.status(403).json({ error: 'Not a party to this conversation' });
    }
    const msgs = dbHelpers.getConvMessages(req.params.id);
    res.json(msgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/conversations/:id/messages', requireAuth, validate(sendConvMessageSchema), (req, res) => {
  try {
    const { content } = req.body;
    const conv = dbHelpers.getConversationById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!isPartyToConversation(req, conv)) {
      return res.status(403).json({ error: 'Not a party to this conversation' });
    }
    // Force sender from JWT — never trust the client.
    const msg = dbHelpers.createConvMessage({
      conversation_id: req.params.id,
      sender_id: req.user.sub,
      sender_role: req.user.role,
      content,
    });
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/conversations/:id/read', requireAuth, (req, res) => {
  try {
    const conv = dbHelpers.getConversationById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!isPartyToConversation(req, conv)) {
      return res.status(403).json({ error: 'Not a party to this conversation' });
    }
    dbHelpers.markConvMessagesRead(req.params.id, req.user.sub);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/profiles/operator/:id', (req, res) => {
  try {
    const profile = dbHelpers.getOperatorProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Operator not found' });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/profiles/enterprise/:id', (req, res) => {
  try {
    const profile = dbHelpers.getEnterpriseProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Enterprise not found' });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS / PROFILE UPDATES
// ═══════════════════════════════════════════════════════════════════════════════

app.patch('/api/settings/operator/:id', requireAuth, requireRole('operator'), validate(updateOperatorSettingsSchema), (req, res) => {
  try {
    if (req.user.sub !== req.params.id) {
      return res.status(403).json({ error: 'You can only update your own settings' });
    }
    const updated = dbHelpers.updateOperatorProfile(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Operator not found' });
    res.json({ success: true, user: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/settings/enterprise/:id', requireAuth, requireRole('enterprise'), validate(updateEnterpriseSettingsSchema), (req, res) => {
  try {
    if (req.user.sub !== req.params.id) {
      return res.status(403).json({ error: 'You can only update your own settings' });
    }
    const updated = dbHelpers.updateEnterpriseProfile(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Enterprise not found' });
    res.json({ success: true, user: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT COMPLETION + RATING
// ═══════════════════════════════════════════════════════════════════════════════

// Only the enterprise that owns the contract can complete + rate it.
app.post('/api/contracts/:id/complete', requireAuth, requireRole('enterprise'), validate(completeContractSchema), (req, res) => {
  try {
    const { rating, comment } = req.body;
    const contract = dbHelpers.getContractById?.(req.params.id);
    if (contract && contract.enterprise_id !== req.user.sub) {
      return res.status(403).json({ error: 'Only the owning enterprise can complete this contract' });
    }
    const result = dbHelpers.completeContract(req.params.id, parseFloat(rating), comment);
    if (!result) return res.status(404).json({ error: 'Contract not found' });

    // Release any locked stakes for the operator on this mission.
    if (contract?.mission_id && contract?.operator_id) {
      const stakes = stakeHelpers.getStakesByMission(contract.mission_id)
        .filter(s => s.operator_id === contract.operator_id && s.status === 'locked');
      stakes.forEach(s => stakeHelpers.releaseStake(s.id));
    }

    auditHelpers.log({
      entity_type: 'contract', entity_id: req.params.id, action: 'contract_completed',
      actor_id: req.user.sub, actor_role: 'enterprise',
      payload: { rating, operator_id: contract?.operator_id },
    });

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATOR WITHDRAW
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/operators/:id/withdraw', requireAuth, requireRole('operator'), validate(withdrawSchema), (req, res) => {
  try {
    if (req.user.sub !== req.params.id) {
      return res.status(403).json({ error: 'You can only withdraw your own earnings' });
    }
    const { amount } = req.body;
    const result = dbHelpers.withdrawEarnings(req.params.id, parseFloat(amount));
    if (!result) return res.status(404).json({ error: 'Operator not found' });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC PROFILES (by username / company slug)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/profiles/operator/username/:username', (req, res) => {
  try {
    const operator = dbHelpers.getOperatorByUsername(req.params.username);
    if (!operator) return res.status(404).json({ error: 'Operator not found' });
    const profile = dbHelpers.getOperatorProfile(operator.id);
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/profiles/enterprise/name/:name', (req, res) => {
  try {
    const enterprise = dbHelpers.getEnterpriseByName(req.params.name);
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });
    const profile = dbHelpers.getEnterpriseProfile(enterprise.id);
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER PROXY
// ═══════════════════════════════════════════════════════════════════════════════

function generateMockWeather(lat, lng) {
  const conditions = ['Clear', 'Clouds', 'Rain', 'Wind'];
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
    const wind = Math.round(5 + Math.random() * 25);
    const rain = Math.random() > 0.7 ? Math.round(Math.random() * 15) : 0;
    const temp = Math.round(15 + Math.random() * 20);
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const flyable = wind < 20 && rain === 0 ? 'good' : wind < 30 && rain < 5 ? 'caution' : 'unsafe';
    return { date, wind_kmh: wind, rain_mm: rain, temp_c: temp, condition, flyable };
  });
}

function parseForecastToDailyMap(list) {
  const byDay = {};
  list.forEach(item => {
    const date = item.dt_txt.split(' ')[0];
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(item);
  });
  return Object.entries(byDay).map(([date, items]) => {
    const avgWind = items.reduce((s, i) => s + (i.wind?.speed || 0) * 3.6, 0) / items.length;
    const maxRain = Math.max(...items.map(i => i.rain?.['3h'] || 0));
    const avgTemp = items.reduce((s, i) => s + (i.main?.temp || 20), 0) / items.length;
    const condition = items[Math.floor(items.length / 2)]?.weather?.[0]?.main || 'Clear';
    const wind = Math.round(avgWind);
    const rain = parseFloat(maxRain.toFixed(1));
    const flyable = wind < 20 && rain < 1 ? 'good' : wind < 30 && rain < 5 ? 'caution' : 'unsafe';
    return { date, wind_kmh: wind, rain_mm: rain, temp_c: Math.round(avgTemp), condition, flyable };
  });
}

app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      // Return mock data if no API key configured
      return res.json({ mock: true, daily: generateMockWeather(parseFloat(lat), parseFloat(lng)) });
    }
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&cnt=40`;
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    const response = await fetchFn(url);
    const data = await response.json();
    // Parse into daily summaries
    const daily = parseForecastToDailyMap(data.list || []);
    res.json({ daily });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN: LICENSE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/pending-verifications', (req, res) => {
  try {
    const pending = dbHelpers.getAllOperators().filter(op => op.license_status === 'pending');
    res.json(pending);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/verify-operator/:id', validate(verifyOperatorSchema), (req, res) => {
  try {
    const { status } = req.body;
    const operator = dbHelpers.updateOperator(req.params.id, { license_status: status });
    if (!operator) return res.status(404).json({ error: 'Operator not found' });
    res.json({ success: true, operator });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MISSION DATES UPDATE
// ═══════════════════════════════════════════════════════════════════════════════

app.patch('/api/missions/:id/dates', requireAuth, validate(updateMissionDatesSchema), (req, res) => {
  try {
    const existing = dbHelpers.getMissionById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Mission not found' });
    if (existing.enterprise_id !== req.user.sub) {
      return res.status(403).json({ error: 'Only the owning enterprise can edit mission dates' });
    }
    const { start_date, end_date } = req.body;
    const mission = dbHelpers.updateMission(req.params.id, { start_date, end_date });
    res.json(mission);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUBTASK CLAIMING — operator claims a specific subtask on a mission
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/missions/:id/subtasks/:subtaskId/claim
// Body: { operator_name } — operator_id is taken from the JWT.
app.post('/api/missions/:id/subtasks/:subtaskId/claim', requireAuth, requireRole('operator'), validate(claimSubtaskSchema), (req, res) => {
  try {
    const operator_id = req.user.sub;
    const { operator_name } = req.body;

    const mission = dbHelpers.getMissionById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });

    const subtasks = mission.subtasks || [];
    const stIdx = subtasks.findIndex(s => s.id === req.params.subtaskId);
    if (stIdx === -1) return res.status(404).json({ error: 'Subtask not found' });

    const sub = subtasks[stIdx];
    if (sub.claimed_by) {
      return res.status(409).json({ error: 'Subtask already claimed by another operator' });
    }

    // Check operator hasn't already claimed another subtask on this mission
    const alreadyClaimed = subtasks.some(s => s.claimed_by === operator_id);
    if (alreadyClaimed) {
      return res.status(409).json({ error: 'You have already claimed a subtask on this mission' });
    }

    subtasks[stIdx] = {
      ...sub,
      claimed_by: operator_id,
      claimed_by_name: operator_name || null,
      claimed_at: Date.now(),
      status: 'claimed',
    };

    const updated = dbHelpers.updateMission(req.params.id, { subtasks });
    res.json({ success: true, subtask: subtasks[stIdx], mission: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/missions/:id/subtasks/:subtaskId/complete
// operator_id is taken from the JWT.
app.post('/api/missions/:id/subtasks/:subtaskId/complete', requireAuth, requireRole('operator'), (req, res) => {
  try {
    const operator_id = req.user.sub;
    const mission = dbHelpers.getMissionById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });

    const subtasks = mission.subtasks || [];
    const stIdx = subtasks.findIndex(s => s.id === req.params.subtaskId);
    if (stIdx === -1) return res.status(404).json({ error: 'Subtask not found' });

    if (subtasks[stIdx].claimed_by !== operator_id) {
      return res.status(403).json({ error: 'You do not own this subtask' });
    }

    subtasks[stIdx] = { ...subtasks[stIdx], status: 'completed', completed_at: Date.now() };

    // If all subtasks complete, mark mission complete
    const allDone = subtasks.every(s => s.status === 'completed');
    const missionUpdates = { subtasks };
    if (allDone) missionUpdates.status = 'completed';

    const updated = dbHelpers.updateMission(req.params.id, missionUpdates);
    res.json({ success: true, subtask: subtasks[stIdx], mission: updated, allSubtasksDone: allDone });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEVNET ESCROW — on-chain SOL payments
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/escrow/info — returns escrow address + live devnet balance
app.get('/api/escrow/info', async (req, res) => {
  try {
    const { sol, lamports } = await getEscrowBalance();
    res.json({
      address: ESCROW_ADDRESS,
      network: 'devnet',
      balance_sol: sol,
      balance_lamports: lamports,
      explorerUrl: `https://explorer.solana.com/address/${ESCROW_ADDRESS}?cluster=devnet`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/escrow/airdrop — devnet airdrop helper. Authed (any role) to
// prevent anonymous abuse of the rate-limited devnet faucet.
app.post('/api/escrow/airdrop', requireAuth, async (req, res) => {
  try {
    const balance = await ensureEscrowFunded(0);
    res.json({ success: true, balance_sol: (balance || 0) / 1e9 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/escrow/verify-deposit
// Body: { txSignature, missionId, expectedSol }
// fromWallet is forced to the authenticated user's wallet to prevent spoofing.
// Only the owning enterprise can stamp a mission as funded.
app.post('/api/escrow/verify-deposit', requireAuth, requireRole('enterprise'), validate(verifyDepositSchema), async (req, res) => {
  try {
    const { txSignature, missionId, expectedSol } = req.body;
    const mission = dbHelpers.getMissionById(missionId);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    if (mission.enterprise_id !== req.user.sub) {
      return res.status(403).json({ error: 'Only the owning enterprise can fund this mission' });
    }
    const fromWallet = req.user.wallet;
    const expectedLamports = solToLamports(expectedSol || 0);
    const result = await verifyDeposit(txSignature, fromWallet, expectedLamports);

    if (!result.ok) {
      return res.status(422).json({ error: `Deposit verification failed: ${result.reason}` });
    }

    const updated = dbHelpers.updateMission(missionId, {
      escrow_tx: txSignature,
      escrow_deposited_lamports: result.deposited,
      escrow_status: 'funded',
    });

    res.json({
      success: true,
      deposited_sol: result.deposited / 1e9,
      txSignature,
      explorerUrl: `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
      mission: updated,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/contracts/:id/release-payment
// Pays operator from escrow when contract is completed.
// Only the enterprise that owns the contract can trigger payout.
app.post('/api/contracts/:id/release-payment', requireAuth, requireRole('enterprise'), async (req, res) => {
  try {
    const contract = dbHelpers.getContractById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.enterprise_id !== req.user.sub) {
      return res.status(403).json({ error: 'Only the owning enterprise can release payment' });
    }

    // Get operator wallet
    const operator = dbHelpers.getOperatorById(contract.operator_id);
    if (!operator?.wallet_address) {
      return res.status(400).json({ error: 'Operator wallet not found' });
    }

    // Get mission to find escrowed amount
    const mission = dbHelpers.getMissionById(contract.mission_id);
    const lamports = mission?.escrow_deposited_lamports || solToLamports(contract.amount_sol || 0);

    if (!lamports || lamports <= 0) {
      return res.status(400).json({ error: 'No escrowed amount found for this contract' });
    }

    const result = await payOperator(operator.wallet_address, lamports);

    if (!result.ok) {
      return res.status(500).json({ error: `Payment failed: ${result.reason}` });
    }

    // Record payout tx on contract
    dbHelpers.updateContract(req.params.id, {
      payout_tx: result.signature,
      payout_status: 'paid',
    });

    if (mission) {
      dbHelpers.updateMission(mission.id, { escrow_status: 'released' });
    }

    res.json({
      success: true,
      paid_sol: lamports / 1e9,
      signature: result.signature,
      explorerUrl: result.explorerUrl,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NASA EONET — Natural Events (fires, storms, floods, etc.)
// Free API, no key required. https://eonet.gsfc.nasa.gov/docs/v3
// ═══════════════════════════════════════════════════════════════════════════════

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// GET /api/eonet?lat=X&lng=Y&radius=500&days=30
// Returns NASA EONET natural events within `radius` km of coordinates
app.get('/api/eonet', async (req, res) => {
  try {
    const { lat, lng, radius = 500, days = 30 } = req.query;
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;

    const url = `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=${days}&limit=100`;
    const resp = await fetchFn(url, { headers: { 'Accept': 'application/json' } });
    const data = await resp.json();

    let events = data.events || [];

    // Filter by proximity if lat/lng provided
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      events = events.filter(ev => {
        const coords = ev.geometry?.[0]?.coordinates;
        if (!coords) return false;
        // EONET uses [lng, lat] order
        const evLng = Array.isArray(coords[0]) ? coords[0][0] : coords[0];
        const evLat = Array.isArray(coords[0]) ? coords[0][1] : coords[1];
        const dist = haversineKm(userLat, userLng, evLat, evLng);
        ev._distance_km = Math.round(dist);
        return dist <= radiusKm;
      });
    }

    // Shape events for frontend
    const shaped = events.map(ev => {
      const geo = ev.geometry?.[0];
      const coords = geo?.coordinates;
      const evLng = Array.isArray(coords?.[0]) ? coords[0][0] : coords?.[0];
      const evLat = Array.isArray(coords?.[0]) ? coords[0][1] : coords?.[1];
      return {
        id: ev.id,
        title: ev.title,
        category: ev.categories?.[0]?.title || 'Unknown',
        categoryId: ev.categories?.[0]?.id || '',
        date: geo?.date || null,
        lat: evLat,
        lng: evLng,
        distance_km: ev._distance_km || null,
        sources: ev.sources?.map(s => s.url) || [],
      };
    }).sort((a, b) => (a.distance_km || 9999) - (b.distance_km || 9999));

    res.json({ count: shaped.length, events: shaped });
  } catch (e) {
    console.error('[EONET]', e.message);
    res.status(500).json({ error: e.message, events: [] });
  }
});

// GET /api/weather/current?lat=X&lng=Y — detailed current conditions
// Returns richer data: humidity, pressure, feels_like, UV index via mock or OWM
app.get('/api/weather/current', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      // Deterministic mock based on coordinates
      const seed = Math.abs(parseFloat(lat) * 100 + parseFloat(lng));
      const temp = Math.round(5 + (seed % 30));
      const wind = Math.round(5 + (seed % 35));
      const humidity = Math.round(30 + (seed % 50));
      const pressure = Math.round(1000 + (seed % 30));
      const conditions = ['Clear', 'Clouds', 'Rain', 'Wind', 'Mist'];
      const condition = conditions[Math.floor(seed % conditions.length)];
      const feelsLike = Math.round(temp - (wind > 20 ? 3 : 0));
      const visibility = condition === 'Mist' ? 2 : condition === 'Rain' ? 5 : 10;
      const flyable = wind < 20 && !['Rain','Thunderstorm'].includes(condition) ? 'good'
                    : wind < 30 ? 'caution' : 'unsafe';
      return res.json({
        mock: true, lat, lng,
        temp_c: temp, feels_like_c: feelsLike,
        wind_kmh: wind, wind_direction: ['N','NE','E','SE','S','SW','W','NW'][Math.floor(seed % 8)],
        humidity_pct: humidity, pressure_hpa: pressure,
        visibility_km: visibility, condition, flyable,
        updated_at: new Date().toISOString(),
      });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    const response = await fetchFn(url);
    const d = await response.json();
    const wind = Math.round((d.wind?.speed || 0) * 3.6);
    const condition = d.weather?.[0]?.main || 'Clear';
    const flyable = wind < 20 && !['Rain','Thunderstorm','Snow'].includes(condition) ? 'good'
                  : wind < 30 ? 'caution' : 'unsafe';
    res.json({
      temp_c: Math.round(d.main?.temp || 0),
      feels_like_c: Math.round(d.main?.feels_like || 0),
      wind_kmh: wind,
      wind_direction: d.wind?.deg ? ['N','NE','E','SE','S','SW','W','NW'][Math.round(d.wind.deg / 45) % 8] : '—',
      humidity_pct: d.main?.humidity || 0,
      pressure_hpa: d.main?.pressure || 0,
      visibility_km: Math.round((d.visibility || 10000) / 1000),
      condition,
      flyable,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LAANC-style airspace check (mock)
// ═══════════════════════════════════════════════════════════════════════════════
// Mocks an FAA LAANC / EASA U-space airspace authorization lookup. The real
// service would hit https://laanc.faa.gov or similar. Output is deterministic
// based on lat/lng so the same coordinates always return the same verdict
// (handy for demos and screenshots). Replace with a real upstream by swapping
// the body of computeAirspaceStub() — the endpoint contract stays the same.
function computeAirspaceStub(lat, lng) {
  const seed = Math.abs(parseFloat(lat) * 137 + parseFloat(lng) * 31);
  const bucket = Math.floor(seed) % 10;

  // Bucket distribution: 6 cleared, 3 caution, 1 restricted.
  let status, max_altitude_ft, requires_authorization;
  if (bucket === 0) {
    status = 'restricted';
    max_altitude_ft = 0;
    requires_authorization = true;
  } else if (bucket < 4) {
    status = 'caution';
    max_altitude_ft = 200;
    requires_authorization = true;
  } else {
    status = 'cleared';
    max_altitude_ft = 400;
    requires_authorization = false;
  }

  const airspaceClasses = ['Class G', 'Class E', 'Class D', 'Class C', 'Class B'];
  const klass = airspaceClasses[bucket % airspaceClasses.length];

  const notamTemplates = [
    'Temporary flight restriction: stadium event',
    'Active military operations area',
    'Wildfire suppression — TFR active',
    'Presidential / VIP movement notice',
    'Powerline construction below 200 ft AGL',
  ];
  const notams = bucket < 3 ? [notamTemplates[bucket % notamTemplates.length]] : [];

  return {
    status,
    airspace_class: klass,
    max_altitude_ft,
    requires_authorization,
    active_notams: notams,
    nearby_facilities: bucket < 5 ? [`${klass} airport (12.4 km NE)`] : [],
    source: 'LAANC mock (Phase 7 stub)',
    last_checked: new Date().toISOString(),
    explainer: status === 'cleared'
      ? 'Operations cleared up to 400 ft AGL without prior authorization.'
      : status === 'caution'
        ? 'Operations permitted but require LAANC authorization or active monitoring.'
        : 'Operations prohibited in this airspace without specific waiver.',
  };
}

// GET /api/airspace/check?lat=X&lng=Y
app.get('/api/airspace/check', (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  const out = computeAirspaceStub(parseFloat(lat), parseFloat(lng));
  res.json({ lat: parseFloat(lat), lng: parseFloat(lng), ...out });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — MULTI-OPERATOR SLOTS, ELIGIBILITY, REPUTATION, DISPUTES, AUDIT, FSM
// ═══════════════════════════════════════════════════════════════════════════════

// ── Slots ────────────────────────────────────────────────────────────────────

// GET /api/missions/:id/slots — list all slots on a mission with operator info.
// Public so the mission detail page can show "3/4 filled" without auth.
app.get('/api/missions/:id/slots', (req, res) => {
  try {
    const slots = slotHelpers.getSlotsByMission(req.params.id);
    const counts = slotHelpers.countSlotStatuses(req.params.id);
    res.json({ slots, counts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/missions/:id/slots/:slotId/claim
// Operator claims a slot. Requires eligibility. Optionally locks a stake.
app.post('/api/missions/:id/slots/:slotId/claim',
  requireAuth, requireRole('operator'), validate(claimSlotSchema),
  (req, res) => {
    try {
      const mission = dbHelpers.getMissionById(req.params.id);
      if (!mission) return res.status(404).json({ error: 'Mission not found' });
      const slot = slotHelpers.getSlotById(req.params.slotId);
      if (!slot || slot.mission_id !== mission.id) return res.status(404).json({ error: 'Slot not found' });

      const operator = dbHelpers.getOperatorById(req.user.sub);
      if (!operator) return res.status(404).json({ error: 'Operator not found' });

      // Eligibility gate.
      const elig = evaluateEligibility(operator, mission, slot);
      if (!elig.eligible) {
        return res.status(409).json({ error: 'Not eligible for this slot', missingRequirements: elig.missingRequirements });
      }

      const claimedSlot = slotHelpers.claimSlot(req.params.slotId, req.user.sub);

      // Optional stake lock (server-side bookkeeping; on-chain Anchor program is Phase 5).
      let stake = null;
      if (req.body.stake_lamports > 0) {
        stake = stakeHelpers.lockStake(req.user.sub, mission.id, req.body.stake_lamports);
      }

      // Auto-transition the mission status based on fill count.
      const counts = slotHelpers.countSlotStatuses(mission.id);
      const required = mission.required_operators || mission.operators_needed || 1;
      const filled = counts.claimed + counts.active + counts.completed;
      let newStatus = mission.status;
      if (filled >= required)        newStatus = 'fully_staffed';
      else if (filled > 0)            newStatus = 'partially_filled';
      if (newStatus !== mission.status && canTransition(mission.status, newStatus, 'system')) {
        dbHelpers.updateMission(mission.id, { status: newStatus });
        auditHelpers.log({
          entity_type: 'mission', entity_id: mission.id, action: 'mission_status_changed',
          actor_id: null, actor_role: 'system',
          payload: { from: mission.status, to: newStatus, trigger: 'slot_claim' },
        });
      }

      auditHelpers.log({
        entity_type: 'mission', entity_id: mission.id, action: 'slot_claimed',
        actor_id: req.user.sub, actor_role: 'operator',
        payload: { slot_id: claimedSlot.id, slot_index: claimedSlot.slot_index, stake_lamports: req.body.stake_lamports || 0 },
      });

      res.json({ slot: claimedSlot, stake, missionStatus: newStatus });
    } catch (e) {
      const msg = e.message || 'Claim failed';
      const status = msg.includes('already') || msg.includes('not open') ? 409 : 500;
      res.status(status).json({ error: msg });
    }
  });

// POST /api/missions/:id/slots/:slotId/activate — operator marks ready to work.
app.post('/api/missions/:id/slots/:slotId/activate', requireAuth, requireRole('operator'), (req, res) => {
  try {
    const slot = slotHelpers.activateSlot(req.params.slotId, req.user.sub);
    auditHelpers.log({
      entity_type: 'mission', entity_id: req.params.id, action: 'slot_activated',
      actor_id: req.user.sub, actor_role: 'operator',
      payload: { slot_id: slot.id },
    });

    // Auto-transition mission to active if any slot is active.
    const mission = dbHelpers.getMissionById(req.params.id);
    if (mission && canTransition(mission.status, 'active', 'system')) {
      dbHelpers.updateMission(mission.id, { status: 'active' });
    }
    res.json({ slot });
  } catch (e) { res.status(409).json({ error: e.message }); }
});

// POST /api/missions/:id/slots/:slotId/complete — operator marks slot done.
app.post('/api/missions/:id/slots/:slotId/complete', requireAuth, requireRole('operator'), (req, res) => {
  try {
    const slot = slotHelpers.completeSlot(req.params.slotId, req.user.sub);
    auditHelpers.log({
      entity_type: 'mission', entity_id: req.params.id, action: 'slot_completed',
      actor_id: req.user.sub, actor_role: 'operator',
      payload: { slot_id: slot.id },
    });

    // If all slots completed, mission moves to 'submitted' awaiting enterprise sign-off.
    const counts = slotHelpers.countSlotStatuses(req.params.id);
    const mission = dbHelpers.getMissionById(req.params.id);
    if (mission && counts.completed === counts.total && counts.total > 0) {
      if (canTransition(mission.status, 'submitted', 'system')) {
        dbHelpers.updateMission(mission.id, { status: 'submitted' });
        auditHelpers.log({
          entity_type: 'mission', entity_id: mission.id, action: 'mission_status_changed',
          actor_id: null, actor_role: 'system',
          payload: { from: mission.status, to: 'submitted', trigger: 'all_slots_completed' },
        });
      }
    }

    res.json({ slot, allSlotsDone: counts.completed === counts.total });
  } catch (e) { res.status(409).json({ error: e.message }); }
});

// ── Eligibility ──────────────────────────────────────────────────────────────

// GET /api/missions/:id/eligibility — eligibility for the AUTHENTICATED operator.
// Returns { eligible, missingRequirements, score } so the mission card can show
// a "you qualify" badge and rank applicants.
app.get('/api/missions/:id/eligibility', requireAuth, requireRole('operator'), (req, res) => {
  try {
    const mission = dbHelpers.getMissionById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    const operator = dbHelpers.getOperatorById(req.user.sub);
    if (!operator) return res.status(404).json({ error: 'Operator not found' });
    res.json(evaluateEligibility(operator, mission));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Reputation ───────────────────────────────────────────────────────────────

// GET /api/operators/:id/reputation — public reputation breakdown.
// Pulls live signals from operator_stakes for the slash penalty.
app.get('/api/operators/:id/reputation', (req, res) => {
  try {
    const operator = dbHelpers.getOperatorById(req.params.id);
    if (!operator) return res.status(404).json({ error: 'Operator not found' });
    const stakes = stakeHelpers.getStakeCounts(req.params.id);
    const score = computeReputationScore(operator, {
      slashedStakes: stakes.slashed,
      releasedStakes: stakes.released,
    });
    res.json(score);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Risk score ───────────────────────────────────────────────────────────────

app.get('/api/missions/:id/risk', (req, res) => {
  try {
    const mission = dbHelpers.getMissionById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    const slots = slotHelpers.getSlotsByMission(req.params.id);
    const operatorScores = slots
      .filter(s => s.operator_id)
      .map(s => {
        const op = dbHelpers.getOperatorById(s.operator_id);
        if (!op) return 0;
        const stakes = stakeHelpers.getStakeCounts(op.id);
        return computeReputationScore(op, { slashedStakes: stakes.slashed }).score;
      });
    res.json(computeMissionRisk(mission, slots, operatorScores));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Disputes ─────────────────────────────────────────────────────────────────

// POST /api/contracts/:id/dispute — either party raises a dispute.
app.post('/api/contracts/:id/dispute', requireAuth, validate(raiseDisputeSchema), (req, res) => {
  try {
    const contract = dbHelpers.getContractById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const isParty = contract.enterprise_id === req.user.sub || contract.operator_id === req.user.sub;
    if (!isParty) return res.status(403).json({ error: 'Only contract parties can raise disputes' });

    const dispute = disputeHelpers.createDispute({
      contract_id: req.params.id,
      raised_by_role: req.user.role,
      raised_by_id: req.user.sub,
      reason: req.body.reason,
      evidence: req.body.evidence,
    });

    // Move the parent mission to 'disputed' if FSM allows.
    if (contract.mission_id) {
      const mission = dbHelpers.getMissionById(contract.mission_id);
      if (mission && canTransition(mission.status, 'disputed', req.user.role)) {
        dbHelpers.updateMission(mission.id, { status: 'disputed' });
      }
    }

    auditHelpers.log({
      entity_type: 'contract', entity_id: req.params.id, action: 'dispute_raised',
      actor_id: req.user.sub, actor_role: req.user.role,
      payload: { dispute_id: dispute.id, reason: req.body.reason },
    });

    res.json({ dispute });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/contracts/:id/disputes — list disputes on a contract.
app.get('/api/contracts/:id/disputes', requireAuth, (req, res) => {
  try {
    const contract = dbHelpers.getContractById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const isParty = contract.enterprise_id === req.user.sub || contract.operator_id === req.user.sub;
    if (!isParty) return res.status(403).json({ error: 'Only contract parties can view disputes' });
    res.json(disputeHelpers.getDisputesByContract(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/disputes — admin queue.
app.get('/api/admin/disputes', (req, res) => {
  try { res.json(disputeHelpers.getOpenDisputes()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/disputes/:id/resolve — admin issues a verdict.
// Decision drives stake fate: operator_wins → release; enterprise_wins → slash.
app.post('/api/admin/disputes/:id/resolve', validate(resolveDisputeSchema), (req, res) => {
  try {
    const dispute = disputeHelpers.getDisputeById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    const contract = dbHelpers.getContractById(dispute.contract_id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const { decision, resolution_note } = req.body;
    const stakes = stakeHelpers.getStakesByMission(contract.mission_id || '')
      .filter(s => s.operator_id === contract.operator_id && s.status === 'locked');

    if (decision === 'enterprise_wins') {
      stakes.forEach(s => stakeHelpers.slashStake(s.id));
    } else if (decision === 'operator_wins' || decision === 'split') {
      stakes.forEach(s => stakeHelpers.releaseStake(s.id));
    }
    // 'dismiss' leaves stakes locked — re-evaluate later.

    const finalStatus = decision === 'dismiss' ? 'dismissed' : 'resolved';
    const resolved = disputeHelpers.resolveDispute(req.params.id, resolution_note, finalStatus);

    // Drive parent mission to a terminal state.
    if (contract.mission_id) {
      const mission = dbHelpers.getMissionById(contract.mission_id);
      const target = decision === 'enterprise_wins' ? 'cancelled' : 'completed';
      if (mission && mission.status === 'disputed' && canTransition('disputed', target, 'admin')) {
        dbHelpers.updateMission(mission.id, { status: target });
      }
    }

    auditHelpers.log({
      entity_type: 'contract', entity_id: dispute.contract_id, action: 'dispute_resolved',
      actor_id: null, actor_role: 'admin',
      payload: { dispute_id: req.params.id, decision, slashed: decision === 'enterprise_wins' ? stakes.length : 0 },
    });

    res.json({ dispute: resolved, decision, stakes_settled: stakes.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Audit trail ──────────────────────────────────────────────────────────────

// GET /api/missions/:id/audit — public timeline of every state change on a mission.
app.get('/api/missions/:id/audit', (req, res) => {
  try {
    const events = auditHelpers.getByEntity('mission', req.params.id, 200);
    res.json({ events });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/contracts/:id/audit', requireAuth, (req, res) => {
  try {
    const contract = dbHelpers.getContractById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const isParty = contract.enterprise_id === req.user.sub || contract.operator_id === req.user.sub;
    if (!isParty) return res.status(403).json({ error: 'Only contract parties can view this audit' });
    const events = auditHelpers.getByEntity('contract', req.params.id, 200);
    res.json({ events });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FSM-driven transition endpoint ───────────────────────────────────────────
// Cleaner alternative to PATCH /api/missions/:id when the only change is status.
app.post('/api/missions/:id/transition', requireAuth, validate(transitionMissionSchema), (req, res) => {
  try {
    const mission = dbHelpers.getMissionById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });

    const role = mission.enterprise_id === req.user.sub ? 'enterprise'
               : 'operator';
    try {
      assertTransition(mission.status, req.body.to, role);
    } catch (err) {
      if (err instanceof FSMError) return res.status(409).json({ error: err.message, code: err.code, allowed: MISSION_TRANSITIONS[mission.status] });
      throw err;
    }

    const updated = dbHelpers.updateMission(mission.id, { status: req.body.to });
    auditHelpers.log({
      entity_type: 'mission', entity_id: mission.id, action: 'mission_status_changed',
      actor_id: req.user.sub, actor_role: role,
      payload: { from: mission.status, to: req.body.to, ...(req.body.payload || {}) },
    });

    res.json({ mission: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Operator experiences (LinkedIn-style work history) ──────────────────────

// Public — anyone can view an operator's work history on their profile.
app.get('/api/operators/:id/experiences', (req, res) => {
  try {
    const operator = dbHelpers.getOperatorById(req.params.id);
    if (!operator) return res.status(404).json({ error: 'Operator not found' });
    res.json(experienceHelpers.getExperiencesByOperator(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auth — only the operator themselves can add to their work history.
app.post('/api/operators/:id/experiences',
  requireAuth, requireRole('operator'), validate(createExperienceSchema),
  (req, res) => {
    try {
      if (req.user.sub !== req.params.id) {
        return res.status(403).json({ error: 'You can only edit your own experiences' });
      }
      const exp = experienceHelpers.createExperience(req.params.id, req.body);
      auditHelpers.log({
        entity_type: 'operator', entity_id: req.params.id, action: 'experience_added',
        actor_id: req.user.sub, actor_role: 'operator',
        payload: { company: exp.company, role: exp.role },
      });
      res.json(exp);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

app.patch('/api/operators/:id/experiences/:expId',
  requireAuth, requireRole('operator'), validate(updateExperienceSchema),
  (req, res) => {
    try {
      if (req.user.sub !== req.params.id) {
        return res.status(403).json({ error: 'You can only edit your own experiences' });
      }
      const existing = experienceHelpers.getExperienceById(req.params.expId);
      if (!existing || existing.operator_id !== req.params.id) {
        return res.status(404).json({ error: 'Experience not found' });
      }
      const updated = experienceHelpers.updateExperience(req.params.expId, req.body);
      res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

app.delete('/api/operators/:id/experiences/:expId',
  requireAuth, requireRole('operator'),
  (req, res) => {
    try {
      if (req.user.sub !== req.params.id) {
        return res.status(403).json({ error: 'You can only edit your own experiences' });
      }
      const existing = experienceHelpers.getExperienceById(req.params.expId);
      if (!existing || existing.operator_id !== req.params.id) {
        return res.status(404).json({ error: 'Experience not found' });
      }
      experienceHelpers.deleteExperience(req.params.expId);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

// ── Marketplace search ──────────────────────────────────────────────────────

// Browse operators (used by enterprises). Public — no PII beyond what's
// already on public profiles.
app.get('/api/search/operators', (req, res) => {
  try {
    const operators = searchHelpers.searchOperators({
      region: req.query.region,
      cert: req.query.cert,
      vehicle_type: req.query.vehicle_type,
      min_rating: req.query.min_rating,
      min_hours: req.query.min_hours,
      license_status: req.query.license_status,
    });
    // Attach reputation score so the result card can rank/display.
    const enriched = operators.map(op => {
      const stakes = stakeHelpers.getStakeCounts(op.id);
      const rep = computeReputationScore(op, { slashedStakes: stakes.slashed });
      return { ...op, reputation: rep.score };
    });
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Browse enterprises (used by operators).
app.get('/api/search/enterprises', (req, res) => {
  try {
    const enterprises = searchHelpers.searchEnterprises({
      industry: req.query.industry,
      region: req.query.region,
      verified: req.query.verified === 'true',
    });
    res.json(enterprises);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Demo seed ────────────────────────────────────────────────────────────────
// POST /api/admin/seed-demo — wipes the DB and re-seeds with demo data.
// Note: gated only by being a server-side endpoint (admin endpoints are open
// per existing demo design). Lock down with requireRole('admin') in prod.
app.post('/api/admin/seed-demo', (req, res) => {
  try {
    const summary = seedDemoData({ wipe: true });
    res.json({ success: true, ...summary });
  } catch (e) {
    console.error('Seed error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Serve the built frontend in production ──────────────────────────────────
// If a dist/ build exists (which `npm run build` produces), serve it from the
// same Express process. Means one deploy = one URL = both frontend and API.
// In dev, Vite handles the frontend on :5173 and this block is a no-op.
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback — anything not /api or /uploads serves index.html so
  // react-router handles client-side routes (/missions/:id etc.).
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`📦 Serving built frontend from ${distDir}`);
}

// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`🚀 Sol Skies server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads: ${path.join(__dirname, 'uploads')}`);
  console.log(`🔑 Escrow address: ${ESCROW_ADDRESS} (devnet)`);
  // Silently try to fund escrow at startup — non-blocking
  ensureEscrowFunded().catch(() => {});
});

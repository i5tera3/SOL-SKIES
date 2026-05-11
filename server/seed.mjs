// server/seed.mjs
// One-click demo seed for hackathon presentations.
//
// Populates a clean, coherent set of records that exercise every Phase 4
// feature: multi-operator missions, slot claiming, ratings, disputes, audit
// trail, reputation scoring across operators with different capabilities.
//
// Wallet addresses are deterministic Solana base58 strings (not real keypairs —
// they exist only as identifiers in our DB. The demo never tries to sign with
// these wallets; flows that need a real wallet use the connected user's).

import { dbHelpers, slotHelpers, stakeHelpers, auditHelpers, experienceHelpers, db } from './database.mjs';

// Pre-generated devnet base58 strings (not associated with any real keypair).
const DEMO_WALLETS = {
  pilot_alex:   '8KqNvB7uF3HtPvKxvCJqMjZxA1ZmYcLrWqM6N3pK5xRz',
  pilot_zara:   '6FxRmLp9YqM4vN2sBjK1cT5eQwG7rH8yP3uXfA9bC2dE',
  pilot_jordan: '4DqWk1Vc8YnRb5LpM2sH9fT3eN6JxCgK7bP4uA8mZ5oR',
  ent_skybuild: '9Hpq68R5nFn3ggRQfw2KUtWJYqU9E8MN2svCKfc9ssgd',
  ent_pipeflow: '3CzM5K8vL2bN9qP4eR1tH7yJ6dW3fG8aS5xZ2cV6mB1n',
};

// Idempotent — wipes the DB and re-seeds. Call only from the admin endpoint.
export function seedDemoData({ wipe = true } = {}) {
  if (wipe) dbHelpers.clearAll();

  // ── Operators ──────────────────────────────────────────────────────────────
  const alex = dbHelpers.createOperator({
    wallet_address: DEMO_WALLETS.pilot_alex,
    full_name: 'Alex Hartmann',
    username: 'alex.hartmann',
    region: 'Germany',
    drone_model: 'DJI Matrice 350 RTK',
    flight_stack: 'px4',
    autopilot_hardware: 'pixhawk_6x',
    vehicle_type: 'multicopter',
    firmware_version: '1.14.0',
    communication_protocol: 'mavlink',
    experience: 'expert',
    certifications: ['part107', 'easa_a2', 'thermography_l1'],
    bio: 'Industrial inspection specialist — 8 years pipeline + powerline thermal work across DACH.',
    flight_hours: 1240,
    drone_fleet: [
      { model: 'DJI Matrice 350 RTK', specs: 'RTK + thermal payload' },
      { model: 'Autel EVO Max 4T',   specs: 'thermal + LiDAR' },
    ],
  });

  const zara = dbHelpers.createOperator({
    wallet_address: DEMO_WALLETS.pilot_zara,
    full_name: 'Zara Khalil',
    username: 'zara.khalil',
    region: 'Jordan',
    drone_model: 'WingtraOne GEN II',
    flight_stack: 'ardupilot',
    autopilot_hardware: 'pixhawk_4',
    vehicle_type: 'vtol',
    firmware_version: '4.5.7',
    communication_protocol: 'mavlink',
    experience: 'advanced',
    certifications: ['caa_jordan', 'mapping_l2'],
    bio: 'Large-area mapping + photogrammetry — Middle East + East Africa coverage.',
    flight_hours: 680,
    drone_fleet: [{ model: 'WingtraOne GEN II', specs: 'fixed-wing VTOL, 60min endurance' }],
  });

  const jordan = dbHelpers.createOperator({
    wallet_address: DEMO_WALLETS.pilot_jordan,
    full_name: 'Jordan Riley',
    username: 'jordan.riley',
    region: 'United States',
    drone_model: 'Skydio X10',
    flight_stack: 'other',
    autopilot_hardware: 'skydio_proprietary',
    vehicle_type: 'multicopter',
    experience: 'intermediate',
    certifications: ['part107'],
    bio: 'Newer to commercial — fast learner, autonomous indoor inspections.',
    flight_hours: 220,
    drone_fleet: [{ model: 'Skydio X10', specs: 'AI obstacle avoidance' }],
  });

  // Apply a verified license to Alex (flagged as verified by admin).
  dbHelpers.updateOperator(alex.id, { license_status: 'verified' });

  // ── Operator work history (LinkedIn-style timeline) ───────────────────────
  experienceHelpers.createExperience(alex.id, {
    company: 'RWE Renewables',
    role: 'Senior Wind Farm Inspector',
    region: 'Germany',
    industry: 'energy',
    start_date: '2021-03',
    end_date: null,
    description: 'Thermal + visual inspection of 40+ offshore turbines per month. Lead pilot on the Nordsee-Ost project.',
    drone_models: ['DJI Matrice 350 RTK', 'Autel EVO Max 4T'],
  });
  experienceHelpers.createExperience(alex.id, {
    company: 'Siemens Energy',
    role: 'Pipeline Thermography Pilot',
    region: 'DACH',
    industry: 'oil_gas',
    start_date: '2018-06', end_date: '2021-02',
    description: 'Methane leak detection across cross-border gas pipelines. Built the SOP for the thermal-imaging workflow.',
    drone_models: ['DJI Matrice 300 RTK'],
  });
  experienceHelpers.createExperience(alex.id, {
    company: 'Bundeswehr (Reserve)',
    role: 'UAV Operator Training Instructor',
    region: 'Germany',
    industry: 'defense',
    start_date: '2016-01', end_date: '2018-05',
    description: 'Trained 60+ new operators on multi-rotor and fixed-wing platforms. EASA A2 certification cohort lead.',
    drone_models: ['Quantum Trinity F90+'],
  });

  experienceHelpers.createExperience(zara.id, {
    company: 'Aramex Last-Mile Pilot Program',
    role: 'Drone Delivery Operator',
    region: 'UAE',
    industry: 'logistics',
    start_date: '2023-09', end_date: null,
    description: 'BVLOS delivery trials for sealed medical samples — 200+ flights, zero incidents.',
    drone_models: ['WingtraOne GEN II'],
  });
  experienceHelpers.createExperience(zara.id, {
    company: 'Royal Jordanian Geographic Centre',
    role: 'Aerial Survey Pilot',
    region: 'Jordan',
    industry: 'mapping',
    start_date: '2020-01', end_date: '2023-08',
    description: 'Photogrammetric surveys for highway expansion projects. Owned the data pipeline from capture to deliverable.',
    drone_models: ['WingtraOne GEN II', 'DJI Phantom 4 RTK'],
  });

  experienceHelpers.createExperience(jordan.id, {
    company: 'Self-employed',
    role: 'Indoor Inspection Specialist',
    region: 'United States',
    industry: 'construction',
    start_date: '2024-06', end_date: null,
    description: 'Autonomous indoor inspections of industrial silos and confined spaces using Skydio.',
    drone_models: ['Skydio X10'],
  });

  // ── Enterprises ────────────────────────────────────────────────────────────
  const skybuild = dbHelpers.createEnterprise({
    wallet_address: DEMO_WALLETS.ent_skybuild,
    company_name: 'Skybuild Energy',
    business_type: 'gmbh',
    year_established: 2012,
    industry: 'oil_gas',
    operating_regions: 'Germany, Netherlands, Poland',
    contact_name: 'Lara Becker',
    contact_email: 'l.becker@skybuild.example',
    contact_phone: '+49 30 0000 0000',
    website: 'https://skybuild.example',
    description: 'Pipeline + storage tank thermal inspection across DACH.',
    business_certificate_url: null,
  });

  const pipeflow = dbHelpers.createEnterprise({
    wallet_address: DEMO_WALLETS.ent_pipeflow,
    company_name: 'Pipeflow MENA',
    business_type: 'llc',
    year_established: 2018,
    industry: 'oil_gas',
    operating_regions: 'Jordan, UAE, Egypt',
    contact_name: 'Omar Said',
    contact_email: 'osaid@pipeflow.example',
    description: 'Cross-border pipeline mapping and methane leak detection.',
  });

  // Top up some balance for posting missions.
  dbHelpers.updateEnterprise(skybuild.id, { usdc_balance: 1500 });
  dbHelpers.updateEnterprise(pipeflow.id, { usdc_balance: 800 });

  // ── Mission 1: single-operator, completed, rated (legacy flow) ─────────────
  const mission1 = dbHelpers.createMission({
    enterprise_id: skybuild.id,
    enterprise_name: skybuild.company_name,
    title: 'Hamburg storage facility — annual thermal',
    mission_type: 'inspection',
    region: 'Hamburg, Germany',
    latitude: 53.5511,
    longitude: 9.9937,
    description: 'Routine thermal scan of 12 storage tanks. RTK preferred.',
    reward: 0.8,
    status: 'completed',
    required_certifications: ['part107', 'thermography_l1'],
    required_min_hours: 200,
    required_vehicle_types: ['multicopter'],
    required_operators: 1,
    escrow_status: 'released',
  });
  const contract1 = dbHelpers.createContract({
    mission_id: mission1.id,
    enterprise_id: skybuild.id,
    operator_id: alex.id,
    operator_name: alex.full_name,
    operator_username: alex.username,
    title: mission1.title,
    region: mission1.region,
    amount_sol: mission1.reward,
    status: 'active',
  });
  dbHelpers.completeContract(contract1.id, 5, 'Excellent work, on time, clean report.');

  // ── Mission 2: multi-operator, partially staffed (the headline demo) ───────
  const mission2 = dbHelpers.createMission({
    enterprise_id: pipeflow.id,
    enterprise_name: pipeflow.company_name,
    title: 'Cross-border pipeline survey — Jordan → UAE',
    mission_type: 'mapping',
    region: 'Jordan, UAE',
    latitude: 31.5,
    longitude: 36.0,
    description: 'Photogrammetric survey of 480km pipeline corridor split across 4 operator regions. Each operator covers ~120km.',
    reward: 4.0,            // 1.0 SOL per slot
    status: 'open',
    required_certifications: ['mapping_l2'],
    required_min_hours: 300,
    required_vehicle_types: ['vtol', 'fixed_wing'],
    required_payload: ['rgb_high_res'],
    required_operators: 4,
    escrow_status: 'funded',
  });
  // Auto-create the 4 slots
  const m2Slots = slotHelpers.createSlotsForMission(mission2.id, 4);
  // Zara claims slot 0 (eligible: VTOL + mapping_l2 + 680h)
  if (m2Slots[0]) {
    slotHelpers.claimSlot(m2Slots[0].id, zara.id);
    stakeHelpers.lockStake(zara.id, mission2.id, 100_000_000); // 0.1 SOL stake
    dbHelpers.updateMission(mission2.id, { status: 'partially_filled' });
    auditHelpers.log({
      entity_type: 'mission', entity_id: mission2.id,
      action: 'slot_claimed', actor_id: zara.id, actor_role: 'operator',
      payload: { slot_id: m2Slots[0].id, slot_index: 0, stake_lamports: 100_000_000 },
    });
  }

  // ── Mission 3: active, single operator (Alex), with subtask demo ───────────
  const mission3 = dbHelpers.createMission({
    enterprise_id: skybuild.id,
    enterprise_name: skybuild.company_name,
    title: 'North Sea wind farm cable inspection',
    mission_type: 'inspection',
    region: 'North Sea',
    latitude: 54.0,
    longitude: 6.5,
    description: 'Subsea cable junction inspections across 6 turbines.',
    reward: 1.5,
    status: 'active',
    required_certifications: ['part107'],
    required_min_hours: 500,
    required_vehicle_types: ['multicopter'],
    required_operators: 1,
    escrow_status: 'funded',
    subtasks: [
      { id: 'st-1', title: 'Turbine A12 junction', status: 'completed', claimed_by: alex.id, claimed_at: Date.now() - 86400000 * 2 },
      { id: 'st-2', title: 'Turbine A14 junction', status: 'claimed',   claimed_by: alex.id, claimed_at: Date.now() - 86400000 },
      { id: 'st-3', title: 'Turbine A16 junction', status: 'pending',   claimed_by: null },
    ],
  });
  dbHelpers.createContract({
    mission_id: mission3.id,
    enterprise_id: skybuild.id,
    operator_id: alex.id,
    operator_name: alex.full_name,
    operator_username: alex.username,
    title: mission3.title,
    region: mission3.region,
    amount_sol: mission3.reward,
    status: 'active',
    progress: 33,
  });

  // ── Audit trail seed entries ───────────────────────────────────────────────
  auditHelpers.log({
    entity_type: 'mission', entity_id: mission2.id, action: 'mission_created',
    actor_id: pipeflow.id, actor_role: 'enterprise',
    payload: { reward: 4.0, slots: 4 },
  });
  auditHelpers.log({
    entity_type: 'mission', entity_id: mission2.id, action: 'mission_funded',
    actor_id: pipeflow.id, actor_role: 'enterprise',
    payload: { lamports: 4_000_000_000 },
  });
  auditHelpers.log({
    entity_type: 'mission', entity_id: mission1.id, action: 'mission_completed',
    actor_id: skybuild.id, actor_role: 'enterprise',
    payload: { rating: 5, operator_id: alex.id },
  });

  return {
    operators: [alex.id, zara.id, jordan.id],
    enterprises: [skybuild.id, pipeflow.id],
    missions: [mission1.id, mission2.id, mission3.id],
    wallets: DEMO_WALLETS,
    summary: {
      operators: 3,
      enterprises: 2,
      missions: 3,
      slots_created: 4,
      slots_claimed: 1,
    },
  };
}

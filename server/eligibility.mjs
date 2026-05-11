// server/eligibility.mjs
// Operator ↔ mission eligibility engine.
//
// Given an operator profile and a mission's requirements, returns:
//   { eligible: boolean, missingRequirements: string[], score: 0..100 }
//
// `score` is the operator's MATCH STRENGTH for this specific mission, separate
// from their global reputation score. It rewards over-qualification (e.g.
// having more than the required hours) so the enterprise UI can rank applicants.
//
// All checks are STRING-NORMALIZED (lowercase + trim) and tolerant of legacy
// data shapes (some old records have `certifications: []`, some have null).

const lc = (v) => (typeof v === 'string' ? v.toLowerCase().trim() : v);
const arr = (v) => (Array.isArray(v) ? v : []);

export function evaluateEligibility(operator, mission, slot = null) {
  if (!operator || !mission) {
    return { eligible: false, missingRequirements: ['Operator or mission missing'], score: 0 };
  }

  // Slot-specific requirements override mission-level if present.
  const reqs = mergedRequirements(mission, slot);
  const missing = [];
  let score = 0;
  let maxScore = 0;

  // ── Certifications ─────────────────────────────────────────────────────────
  const opCerts = arr(operator.certifications).map(lc);
  const reqCerts = arr(reqs.required_certifications).map(lc);
  if (reqCerts.length) {
    maxScore += 30;
    const matched = reqCerts.filter(c => opCerts.includes(c));
    if (matched.length === reqCerts.length) {
      score += 30;
    } else {
      const missingCerts = reqCerts.filter(c => !opCerts.includes(c));
      missing.push(`Missing required certifications: ${missingCerts.join(', ')}`);
    }
  }

  // ── Minimum flight hours ───────────────────────────────────────────────────
  const reqHours = reqs.required_min_hours || 0;
  const opHours  = operator.flight_hours || 0;
  if (reqHours > 0) {
    maxScore += 20;
    if (opHours >= reqHours) {
      // Bonus for being well over-qualified, capped.
      const ratio = Math.min(opHours / reqHours, 3);
      score += Math.min(20, 10 + (ratio - 1) * 5);
    } else {
      missing.push(`Min ${reqHours}h flight time required (you have ${opHours}h)`);
    }
  }

  // ── Vehicle type ───────────────────────────────────────────────────────────
  const reqVehicles = arr(reqs.required_vehicle_types).map(lc);
  if (reqVehicles.length) {
    maxScore += 15;
    if (operator.vehicle_type && reqVehicles.includes(lc(operator.vehicle_type))) {
      score += 15;
    } else {
      missing.push(
        `Mission requires vehicle type: ${reqVehicles.join(' or ')} ` +
        `(you have ${operator.vehicle_type || 'unspecified'})`
      );
    }
  }

  // ── Payload capability ─────────────────────────────────────────────────────
  // Operators don't yet have a payload field; treat as soft requirement
  // (warning if missing, no hard block) until that profile field exists.
  const reqPayload = arr(reqs.required_payload).map(lc);
  if (reqPayload.length) {
    maxScore += 15;
    const opPayload = arr(operator.payload_capabilities).map(lc);
    const matched = reqPayload.filter(p => opPayload.includes(p));
    if (opPayload.length === 0) {
      // No declared payload — soft warning, no hard block (enterprise can decide)
      missing.push(`Mission needs payload: ${reqPayload.join(', ')} (your profile doesn't list any)`);
    } else if (matched.length === reqPayload.length) {
      score += 15;
    } else {
      const gap = reqPayload.filter(p => !opPayload.includes(p));
      missing.push(`Missing payload capabilities: ${gap.join(', ')}`);
    }
  }

  // ── License status ─────────────────────────────────────────────────────────
  // Verified license is rewarded; rejected license is a hard block.
  maxScore += 10;
  if (operator.license_status === 'verified') {
    score += 10;
  } else if (operator.license_status === 'rejected') {
    missing.push('License has been rejected by admin review');
  } else if (operator.license_status === 'pending') {
    score += 5; // partial credit
  }

  // ── Experience tier ────────────────────────────────────────────────────────
  // Soft signal — doesn't block, but contributes to score.
  maxScore += 10;
  const tier = lc(operator.experience);
  if (tier === 'expert')        score += 10;
  else if (tier === 'advanced') score += 8;
  else if (tier === 'intermediate') score += 5;
  else if (tier === 'beginner') score += 2;

  // Normalize to 0–100. If no requirements were checked, score is 100 (any operator OK).
  const normalized = maxScore === 0 ? 100 : Math.round((score / maxScore) * 100);

  return {
    eligible: missing.filter(m => !m.startsWith('Mission needs payload')).length === 0,
    missingRequirements: missing,
    score: normalized,
  };
}

function mergedRequirements(mission, slot) {
  return {
    required_certifications: slot?.requirements?.required_certifications ?? mission.required_certifications,
    required_min_hours:      slot?.requirements?.required_min_hours      ?? mission.required_min_hours,
    required_vehicle_types:  slot?.requirements?.required_vehicle_types  ?? mission.required_vehicle_types,
    required_payload:        slot?.requirements?.required_payload        ?? mission.required_payload,
  };
}

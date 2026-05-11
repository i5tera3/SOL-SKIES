// server/reputation.mjs
// Operator reputation scoring.
//
// Combines real signal sources into a single 0–100 score for ranking & display:
//   - Average rating (40 pts)             — quality of completed work
//   - Completion volume (20 pts)          — sqrt(completed_missions) curve
//   - Flight hours (15 pts)               — sqrt(hours/100) curve
//   - Certifications count (10 pts)       — capped at ~3 certs
//   - License verified (15 pts)           — binary, but heavy
//
// PENALTIES applied AFTER the base score:
//   - Each slashed stake: -10 pts (capped at -30)
//   - License rejected: hard floor of 0
//
// We deliberately avoid pulling raw rating in the public score — sqrt() curves
// reward early activity (low marginal gain at high counts) so a brand-new
// operator with a single 5-star can reach ~50/100, while a veteran with 200
// completions and a 4.6 sits around 95.

export function computeReputationScore(operator, opts = {}) {
  if (!operator) return { score: 0, breakdown: {}, factors: {}, penalties: {} };

  const completed = operator.completed_missions || 0;
  const rating = operator.rating || 0;
  const flightHours = operator.flight_hours || 0;
  const certs = (operator.certifications || []).length;
  const verified = operator.license_status === 'verified';
  const rejected = operator.license_status === 'rejected';

  // Bonus signals from caller (pulled from operator_stakes + ratings tables).
  const slashedStakes = opts.slashedStakes || 0;
  const releasedStakes = opts.releasedStakes || 0;
  const recentRatingCount = opts.recentRatingCount || 0;

  // ── Base components ────────────────────────────────────────────────────────
  const ratingScore   = Math.min(40, rating * 8);              // 5★ = 40
  const volumeScore   = Math.min(20, Math.sqrt(completed) * 5);  // 16 missions ≈ 20
  const hoursScore    = Math.min(15, Math.sqrt(flightHours / 100) * 5); // 900h ≈ 15
  const certScore     = Math.min(10, certs * 3);
  const verifiedScore = verified ? 15 : 0;

  let total = ratingScore + volumeScore + hoursScore + certScore + verifiedScore;

  // ── Penalties ──────────────────────────────────────────────────────────────
  const slashPenalty = Math.min(30, slashedStakes * 10);
  total -= slashPenalty;

  if (rejected) total = 0;

  total = Math.max(0, Math.min(100, Math.round(total)));

  return {
    score: total,
    breakdown: {
      rating: Math.round(ratingScore),
      volume: Math.round(volumeScore),
      hours: Math.round(hoursScore),
      certs: Math.round(certScore),
      verified: verifiedScore,
    },
    penalties: { slash: slashPenalty },
    factors: {
      rating,
      completed_missions: completed,
      flight_hours: flightHours,
      certifications: certs,
      license_status: operator.license_status || 'none',
      slashed_stakes: slashedStakes,
      released_stakes: releasedStakes,
      recent_ratings: recentRatingCount,
    },
  };
}

// ─── Mission risk score ──────────────────────────────────────────────────────
// Surfaced to the enterprise creating/viewing a mission. Considers funding,
// staffing, operator reputation average, and complexity.
//   low    | medium | high
export function computeMissionRisk(mission, slots = [], operatorScores = []) {
  let risk = 0;

  // Funded?
  if (mission.escrow_status !== 'funded') risk += 2;

  // Multi-op staffing
  const required = mission.required_operators || 1;
  const claimed = slots.filter(s => s.operator_id).length;
  if (required > 1 && claimed < required) risk += 2;
  if (required > 1 && claimed === 0)      risk += 1;

  // Average operator reputation among claimed slots
  if (operatorScores.length) {
    const avg = operatorScores.reduce((a, b) => a + b, 0) / operatorScores.length;
    if (avg < 30) risk += 3;
    else if (avg < 50) risk += 2;
    else if (avg < 70) risk += 1;
  } else if (mission.status !== 'open' && mission.status !== 'draft' && mission.status !== 'funded') {
    risk += 1; // committed but no operators with scores yet
  }

  // Complexity
  const subs = (mission.subtasks || []).length;
  if (subs > 8)   risk += 2;
  else if (subs > 4) risk += 1;

  // Stringent requirements
  const reqCerts = (mission.required_certifications || []).length;
  if (reqCerts > 2) risk += 1;
  if ((mission.required_min_hours || 0) > 500) risk += 1;

  if (risk >= 6) return { level: 'high', score: risk };
  if (risk >= 3) return { level: 'medium', score: risk };
  return { level: 'low', score: risk };
}

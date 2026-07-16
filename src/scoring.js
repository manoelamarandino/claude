// Scoring engine. Pure functions only — no DOM, no storage, no side effects.
// Kept deliberately separate so it can be unit-tested in isolation (see test/).
// Every formula and override here traces directly to build spec §2.

// Both axes split at 5.5 — the true midpoint of a 1–10 scale. Using 5 quietly
// biases everything toward "high", so don't.
export const THRESHOLD = 5.5;

// RISK = (Q6×0.5) + (Q7×0.375) + (Q9×0.125)
// Weights keep the original 4:3:1 proportions between harm-to-user, fix cost,
// and reach, renormalised to sum to 1 after the business-exposure question was
// removed. Harm to the user (Q6) is now the clear heaviest driver of risk.
export function computeRisk(a) {
  const risk = a.q6 * 0.5 + a.q7 * 0.375 + a.q9 * 0.125;
  return round1(risk);
}

// CONFIDENCE = (Q1×0.3) + (Q3×0.3) + (Q2×0.2) + ((11 - Q4)×0.2)
// Q4 is inverted so a 1–10 novelty input maps to a 10–1 confidence contribution.
// Override: if Q1 <= 4, CONFIDENCE = min(CONFIDENCE, 5). You cannot be confident
// in a solution to a problem you're not sure exists.
export function computeConfidence(a) {
  let confidence = a.q1 * 0.3 + a.q3 * 0.3 + a.q2 * 0.2 + (11 - a.q4) * 0.2;
  if (a.q1 <= 4) confidence = Math.min(confidence, 5);
  return round1(confidence);
}

// ACCESS = max(Q10, Q11×0.7). Proxies are discounted 30% — real but lesser.
// Take the better of the two paths rather than averaging: only one needs to work.
export function computeAccess(a) {
  return round1(Math.max(a.q10, a.q11 * 0.7));
}

// Access bands, spec §2.
export function accessBand(access) {
  if (access >= 7) return 'open';
  if (access >= 4) return 'constrained';
  return 'blocked';
}

// The 2×2. X axis = confidence, Y axis = risk (risk increasing upward).
export function quadrant(confidence, risk) {
  const highConfidence = confidence >= THRESHOLD;
  const highRisk = risk >= THRESHOLD;
  if (highRisk && highConfidence) return 'VERIFY';
  if (highRisk && !highConfidence) return 'INVEST';
  if (!highRisk && highConfidence) return 'SHIP';
  return 'EXPLORE_CHEAP';
}

// Convenience: compute everything at once from a full answer set.
export function score(a) {
  const risk = computeRisk(a);
  const confidence = computeConfidence(a);
  const access = computeAccess(a);
  return {
    risk,
    confidence,
    access,
    band: accessBand(access),
    quadrant: quadrant(confidence, risk),
  };
}

// Round to one decimal without floating-point noise (0.1 + 0.2 etc).
function round1(n) {
  return Math.round(n * 10) / 10;
}

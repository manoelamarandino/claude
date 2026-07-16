// Unit tests for the pure scoring/flags/recommend logic. No dependencies —
// uses node's built-in test runner. Run with `npm test` (or `node --test`).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeRisk,
  computeConfidence,
  computeAccess,
  accessBand,
  quadrant,
  score,
  THRESHOLD,
} from '../src/scoring.js';
import { computeFlags } from '../src/flags.js';
import { cheapestThingToChangeMind, recommend } from '../src/recommend.js';

// A helper to build a full answer set with sensible mid defaults, overridable.
function answers(overrides = {}) {
  const base = { q1: 5, q2: 5, q3: 5, q4: 5, q5: 1, q6: 5, q7: 5, q9: 5, q10: 5, q11: 5 };
  return { ...base, ...overrides };
}

test('THRESHOLD is the true midpoint, not 5', () => {
  assert.equal(THRESHOLD, 5.5);
});

test('RISK is the documented weighted sum', () => {
  // (8×0.5)+(6×0.375)+(2×0.125) = 4+2.25+0.25 = 6.5
  assert.equal(computeRisk(answers({ q6: 8, q7: 6, q9: 2 })), 6.5);
});

test('RISK weights sum to 1 (max input gives max score)', () => {
  assert.equal(computeRisk(answers({ q6: 10, q7: 10, q9: 10 })), 10);
});

test('RISK is driven hardest by harm to the user (Q6)', () => {
  // Same total input, concentrated on Q6 vs on Q9, should score higher on Q6.
  const heavyOnHarm = computeRisk(answers({ q6: 10, q7: 1, q9: 1 }));
  const heavyOnReach = computeRisk(answers({ q6: 1, q7: 1, q9: 10 }));
  assert.ok(heavyOnHarm > heavyOnReach);
});

test('CONFIDENCE inverts Q4', () => {
  // (7×0.3)+(7×0.3)+(7×0.2)+((11-2)×0.2) = 2.1+2.1+1.4+1.8 = 7.4
  assert.equal(computeConfidence(answers({ q1: 7, q2: 7, q3: 7, q4: 2 })), 7.4);
});

test('CONFIDENCE override: Q1<=4 caps confidence at 5', () => {
  // High everywhere else but problem confidence is 3 → capped.
  const c = computeConfidence(answers({ q1: 3, q2: 10, q3: 10, q4: 1 }));
  assert.equal(c, 5);
});

test('CONFIDENCE override does not raise a lower confidence', () => {
  const c = computeConfidence(answers({ q1: 4, q2: 1, q3: 1, q4: 10 }));
  assert.ok(c < 5);
});

test('ACCESS takes the better path, proxies discounted 30%', () => {
  assert.equal(computeAccess(answers({ q10: 3, q11: 10 })), 7); // 10×0.7 beats 3
  assert.equal(computeAccess(answers({ q10: 8, q11: 1 })), 8); // real users win
});

test('access bands', () => {
  assert.equal(accessBand(7), 'open');
  assert.equal(accessBand(6.9), 'constrained');
  assert.equal(accessBand(4), 'constrained');
  assert.equal(accessBand(3.9), 'blocked');
});

test('quadrant assignment around 5.5', () => {
  assert.equal(quadrant(6, 6), 'VERIFY'); // high conf, high risk
  assert.equal(quadrant(4, 6), 'INVEST'); // low conf, high risk
  assert.equal(quadrant(6, 4), 'SHIP'); // high conf, low risk
  assert.equal(quadrant(4, 4), 'EXPLORE_CHEAP'); // low conf, low risk
  assert.equal(quadrant(5.5, 5.5), 'VERIFY'); // exactly on threshold counts as high
});

test('score() bundles everything', () => {
  const s = score(answers({ q6: 10, q7: 10, q9: 10, q1: 2 }));
  assert.equal(s.quadrant, 'INVEST');
  assert.ok(s.confidence <= 5); // Q1<=4 cap applies
});

// --- flags ------------------------------------------------------------------

test('disagreement flag tiers', () => {
  assert.equal(computeFlags(answers({ q5: 3 }), score(answers({ q5: 3 }))).find((f) => f.id === 'disagreement'), undefined);
  assert.equal(computeFlags(answers({ q5: 6 }), score(answers({ q5: 6 }))).find((f) => f.id === 'disagreement').level, 'note');
  assert.equal(computeFlags(answers({ q5: 9 }), score(answers({ q5: 9 }))).find((f) => f.id === 'disagreement').level, 'flag');
});

test('unvalidated problem flag on Q1<=4', () => {
  const a = answers({ q1: 3 });
  assert.ok(computeFlags(a, score(a)).some((f) => f.id === 'unvalidated-problem'));
});

test('access gap flag: blocked access AND high risk', () => {
  const a = answers({ q6: 10, q7: 10, q9: 10, q10: 1, q11: 1 });
  const s = score(a);
  assert.ok(s.access < 4 && s.risk >= 5.5);
  assert.ok(computeFlags(a, s).some((f) => f.id === 'access-gap'));
});

test('confidence contradiction: high disagreement + high confidence', () => {
  const a = answers({ q5: 9, q1: 9, q2: 9, q3: 9, q4: 1 });
  const s = score(a);
  assert.ok(s.confidence >= 7);
  assert.ok(computeFlags(a, s).some((f) => f.id === 'confidence-contradiction'));
});

test('novelty trap: novel AND confident', () => {
  const a = answers({ q4: 9, q3: 8 });
  assert.ok(computeFlags(a, score(a)).some((f) => f.id === 'novelty-trap'));
});

// --- change-my-mind ---------------------------------------------------------

test('cheapest thing tracks the lowest confidence contributor', () => {
  // Q2 is the weakest → its action is named.
  assert.equal(cheapestThingToChangeMind(answers({ q1: 8, q2: 2, q3: 8, q4: 3 })).questionId, 'q2');
  // High novelty (Q4=10 → inverted 1) becomes the weakest.
  assert.equal(cheapestThingToChangeMind(answers({ q1: 8, q2: 8, q3: 8, q4: 10 })).questionId, 'q4');
});

// --- recommend --------------------------------------------------------------

test('INVEST with shaky problem confidence recommends discovery first', () => {
  const a = answers({ q6: 10, q7: 10, q9: 8, q1: 2, q2: 2 });
  const s = score(a);
  assert.equal(s.quadrant, 'INVEST');
  const rec = recommend(a, s);
  assert.match(rec.primary.method, /Discovery/i);
});

test('SHIP recommendation leads with what you get, never "no research"', () => {
  const a = answers({ q1: 9, q2: 9, q3: 9, q4: 1, q6: 1, q7: 1, q9: 1 });
  const s = score(a);
  assert.equal(s.quadrant, 'SHIP');
  const rec = recommend(a, s);
  assert.match(rec.primary.method, /heuristic/i);
  assert.doesNotMatch(rec.meta.blurb, /don.?t need research/i);
});

test('access adjustment note reflects the band', () => {
  const blocked = recommend(answers(), { ...score(answers()), band: 'blocked' });
  assert.match(blocked.access.title, /Blocked/);
  const open = recommend(answers(), { ...score(answers()), band: 'open' });
  assert.match(open.access.title, /Open/);
});

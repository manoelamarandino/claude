// The log. localStorage-backed. This is the most strategically important feature
// in the app — treat it accordingly (spec §6). No backend, no sharing; every
// completed assessment lands here and stays until the browser is cleared.

import { QUESTION_IDS } from './questions.js';

const KEY = 'rtm.log.v1';

export const OUTCOME_OPTIONS = ['unknown', 'fine', 'minor issues', 'significant issues'];

// --- read / write -----------------------------------------------------------

export function loadLog() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupt storage shouldn't take the app down
  }
}

function saveLog(entries) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

// Append a completed assessment. Returns the stored record (with its id).
export function addEntry(record) {
  const entries = loadLog();
  const stored = {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    methodUsed: '', // editable later — filled in after kickoff
    outcome: 'unknown', // editable later — filled in weeks/months on
    outcomeNotes: '',
    ...record,
  };
  entries.push(stored);
  saveLog(entries);
  return stored;
}

// Patch the editable fields on one entry.
export function updateEntry(id, patch) {
  const entries = loadLog();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...patch };
  saveLog(entries);
  return entries[idx];
}

export function deleteEntry(id) {
  saveLog(loadLog().filter((e) => e.id !== id));
}

// --- summary / calibration --------------------------------------------------

// The numbers that turn a vibes matrix into a thing with evidence behind it.
export function summarize(entries) {
  const byQuadrant = { INVEST: 0, VERIFY: 0, EXPLORE_CHEAP: 0, SHIP: 0 };
  let overridden = 0; // recommended method ≠ method actually used
  let accessGaps = 0;

  for (const e of entries) {
    if (e.quadrant in byQuadrant) byQuadrant[e.quadrant] += 1;
    if (e.methodUsed && e.methodUsed.trim() && e.methodUsed.trim() !== e.recommendedMethod) {
      overridden += 1;
    }
    if (Array.isArray(e.flags) && e.flags.includes('access-gap')) accessGaps += 1;
  }

  // Calibration: of assessments where CONFIDENCE >= 8, what % ended in
  // "significant issues"? This is the point of the whole log.
  const highConfidence = entries.filter((e) => e.confidence >= 8);
  const highConfidenceResolved = highConfidence.filter((e) => e.outcome && e.outcome !== 'unknown');
  const highConfidenceBad = highConfidence.filter((e) => e.outcome === 'significant issues');
  const calibration = {
    highConfidenceCount: highConfidence.length,
    resolvedCount: highConfidenceResolved.length,
    badCount: highConfidenceBad.length,
    // % of RESOLVED high-confidence assessments that went badly — "unknown"
    // outcomes are excluded so the number means something.
    percentBad:
      highConfidenceResolved.length > 0
        ? Math.round((highConfidenceBad.length / highConfidenceResolved.length) * 100)
        : null,
  };

  return { total: entries.length, byQuadrant, overridden, accessGaps, calibration };
}

// --- CSV export -------------------------------------------------------------

const CSV_COLUMNS = [
  'id',
  'timestamp',
  'projectName',
  'team',
  ...QUESTION_IDS,
  'risk',
  'confidence',
  'access',
  'accessBand',
  'quadrant',
  'recommendedMethod',
  'flags',
  'methodUsed',
  'outcome',
  'outcomeNotes',
  'notes',
];

function csvCell(value) {
  if (value == null) return '';
  const s = Array.isArray(value) ? value.join('; ') : String(value);
  // Quote if the cell contains a comma, quote, or newline; escape quotes.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(entries) {
  const header = CSV_COLUMNS.join(',');
  const rows = entries.map((e) => CSV_COLUMNS.map((col) => csvCell(e[col])).join(','));
  return [header, ...rows].join('\n');
}

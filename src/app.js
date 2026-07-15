// App orchestration: view switching, form rendering + validation, result
// screen, and the log. All pure logic lives in the sibling modules; this file
// is the DOM/glue layer. Kept in one place so the wiring is easy to follow.

import { BLOCKS, QUESTION_IDS, QUESTION_BY_ID } from './questions.js';
import { score } from './scoring.js';
import { computeFlags } from './flags.js';
import { recommend } from './recommend.js';
import { renderMatrix } from './matrix.js';
import { resultMarkdown } from './markdown.js';
import {
  loadLog,
  addEntry,
  updateEntry,
  deleteEntry,
  summarize,
  toCsv,
  OUTCOME_OPTIONS,
} from './storage.js';

// --- tiny DOM helpers -------------------------------------------------------

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

const app = document.getElementById('app');
const RISK_QS = ['q6', 'q7', 'q8', 'q9'];
const CONFIDENCE_QS = ['q1', 'q2', 'q3', 'q4'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// --- view router ------------------------------------------------------------

function setActiveNav(view) {
  document.querySelectorAll('[data-nav]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.nav === view);
  });
}

function render(view, payload) {
  app.innerHTML = '';
  setActiveNav(view);
  window.scrollTo(0, 0);
  if (view === 'assessment') app.appendChild(renderAssessment());
  else if (view === 'result') app.appendChild(renderResult(payload));
  else if (view === 'log') app.appendChild(renderLogView());
}

// --- assessment view --------------------------------------------------------

function renderAssessment() {
  const answers = {}; // id -> number, only when touched

  const counter = h('span', { class: 'counter' }, `0 of 11 answered`);
  const submit = h(
    'button',
    { class: 'btn btn-primary', type: 'button', disabled: true, onclick: onSubmit },
    'See recommendation'
  );

  function refreshState() {
    const done = QUESTION_IDS.filter((id) => id in answers).length;
    counter.textContent = `${done} of 11 answered`;
    submit.disabled = done < 11;
  }

  function sliderRow(q) {
    const badge = h('span', { class: 'slider-value', 'aria-hidden': 'true' }, '—');
    const input = h('input', {
      type: 'range',
      min: '1',
      max: '10',
      step: '1',
      value: '5',
      class: 'slider is-untouched',
      id: `s-${q.id}`,
      'aria-label': q.text,
      'aria-valuetext': 'Not set',
    });

    input.addEventListener('input', () => {
      const v = Number(input.value);
      answers[q.id] = v;
      input.classList.remove('is-untouched');
      input.setAttribute('aria-valuetext', String(v));
      badge.textContent = String(v);
      row.classList.remove('is-missing');
      refreshState();
    });

    const row = h('div', { class: 'q', 'data-q': q.id }, [
      h('div', { class: 'q-head' }, [
        h('label', { class: 'q-text', for: `s-${q.id}` }, q.text),
        badge,
      ]),
      q.note ? h('p', { class: 'q-note' }, q.note) : null,
      h('div', { class: 'slider-wrap' }, [
        h('span', { class: 'anchor anchor-low' }, [h('b', {}, '1'), ' ' + q.low]),
        input,
        h('span', { class: 'anchor anchor-high' }, [h('b', {}, '10'), ' ' + q.high]),
      ]),
    ]);
    return row;
  }

  const blocks = BLOCKS.map((block) =>
    h('section', { class: 'block' }, [
      h('div', { class: 'block-head' }, [
        h('h2', {}, block.title),
        h('p', { class: 'block-blurb' }, block.blurb),
      ]),
      ...block.questions.map(sliderRow),
    ])
  );

  // Project metadata.
  const projectName = h('input', { type: 'text', class: 'text-input', placeholder: 'e.g. Checkout redesign', id: 'f-project' });
  const team = h('input', { type: 'text', class: 'text-input', placeholder: 'e.g. Sofia / Payments', id: 'f-team' });
  const notes = h('textarea', { class: 'text-input', rows: '3', placeholder: 'Anything else I should know? (optional)', id: 'f-notes' });

  const meta = h('section', { class: 'block' }, [
    h('div', { class: 'block-head' }, [
      h('h2', {}, 'The project'),
      h('p', { class: 'block-blurb' }, `Date: ${todayISO()} · takes under 5 minutes`),
    ]),
    h('div', { class: 'field' }, [h('label', { for: 'f-project' }, 'Project name'), projectName]),
    h('div', { class: 'field' }, [h('label', { for: 'f-team' }, 'Designer / team'), team]),
    h('div', { class: 'field' }, [h('label', { for: 'f-notes' }, 'Anything else?'), notes]),
  ]);

  const missingMsg = h('p', { class: 'missing-msg', hidden: true }, 'Answer every question first — the vibes only work if they’re complete.');

  function onSubmit() {
    const missing = QUESTION_IDS.filter((id) => !(id in answers));
    if (missing.length) {
      missingMsg.hidden = false;
      let first = null;
      for (const id of missing) {
        const row = app.querySelector(`[data-q="${id}"]`);
        if (row) {
          row.classList.add('is-missing');
          if (!first) first = row;
        }
      }
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const project = {
      projectName: projectName.value.trim(),
      team: team.value.trim(),
      date: todayISO(),
      notes: notes.value.trim(),
    };
    const scores = score(answers);
    const flags = computeFlags(answers, scores);
    const rec = recommend(answers, scores);

    // Persist to the log immediately on completion.
    const stored = addEntry({
      timestamp: new Date().toISOString(),
      projectName: project.projectName,
      team: project.team,
      ...pickAnswers(answers),
      risk: scores.risk,
      confidence: scores.confidence,
      access: scores.access,
      accessBand: scores.band,
      quadrant: scores.quadrant,
      recommendedMethod: rec.primary.method,
      flags: flags.map((f) => f.id),
      notes: project.notes,
    });

    render('result', { answers: { ...answers }, scores, flags, rec, project, entryId: stored.id });
  }

  return h('div', { class: 'view view-assessment' }, [
    h('div', { class: 'intro' }, [
      h('h1', {}, 'Research triage'),
      h('p', {}, 'Eleven quick reads on this design. The result is a starting point for the kickoff conversation — not a verdict. You’ll see your own answers next to whatever it proposes.'),
    ]),
    meta,
    ...blocks,
    h('div', { class: 'submit-bar' }, [counter, missingMsg, submit]),
  ]);
}

function pickAnswers(answers) {
  const out = {};
  for (const id of QUESTION_IDS) out[id] = answers[id];
  return out;
}

// --- result view ------------------------------------------------------------

function scoreCard(title, value, questionIds, answers, invertedId) {
  return h('div', { class: 'score-card' }, [
    h('div', { class: 'score-head' }, [
      h('span', { class: 'score-name' }, title),
      h('span', { class: 'score-value' }, `${value}`),
      h('span', { class: 'score-max' }, '/ 10'),
    ]),
    h(
      'ul',
      { class: 'score-inputs' },
      questionIds.map((id) =>
        h('li', {}, [
          h('span', { class: 'input-answer' }, String(answers[id])),
          h('span', { class: 'input-text' }, [
            QUESTION_BY_ID[id].text,
            id === invertedId ? h('em', { class: 'inv' }, ' (inverted in scoring)') : null,
          ]),
        ])
      )
    ),
  ]);
}

function renderResult(r) {
  const { answers, scores, flags, rec, project } = r;

  // Flags first — the things worth saying first.
  const flagBlock = flags.length
    ? h(
        'div',
        { class: 'flags' },
        flags.map((f) =>
          h('div', { class: `flag flag-${f.level}` }, [
            h('span', { class: 'flag-tag' }, f.level === 'flag' ? 'Flag' : 'Note'),
            h('div', {}, [h('strong', {}, f.title), h('p', {}, f.text)]),
          ])
        )
      )
    : null;

  const matrix = h('div', { class: 'matrix-card' }, [
    renderMatrix(scores.confidence, scores.risk, scores.quadrant),
    h('div', { class: 'matrix-caption' }, [
      h('span', { class: `quad-pill quad-${scores.quadrant}` }, rec.meta.label),
      h('span', {}, rec.meta.tagline),
    ]),
  ]);

  const scoresBlock = h('div', { class: 'scores' }, [
    scoreCard('RISK', scores.risk, RISK_QS, answers),
    scoreCard('CONFIDENCE', scores.confidence, CONFIDENCE_QS, answers, 'q4'),
  ]);

  const accessBlock = h('div', { class: `access access-${scores.band}` }, [
    h('strong', {}, rec.access.title),
    h('p', {}, rec.access.text),
  ]);

  const recBlock = h('div', { class: 'rec' }, [
    h('div', { class: 'rec-blurb' }, rec.meta.blurb),
    h('div', { class: 'rec-primary' }, [
      h('span', { class: 'rec-eyebrow' }, 'Recommended approach'),
      h('h3', {}, rec.primary.method),
      h('p', {}, rec.primary.detail),
    ]),
    h('div', { class: 'rec-alts' }, [
      h('span', { class: 'rec-eyebrow' }, 'Alternatives'),
      h(
        'ul',
        {},
        rec.alternatives.map((alt) =>
          h('li', {}, [
            h('strong', {}, alt.label),
            h('span', { class: 'alt-buys' }, [h('b', {}, 'Buys: '), alt.buys]),
            h('span', { class: 'alt-leaves' }, [h('b', {}, 'Leaves unanswered: '), alt.leaves]),
          ])
        )
      ),
    ]),
  ]);

  const changeMind = h('div', { class: 'change-mind' }, [
    h('span', { class: 'rec-eyebrow' }, 'The cheapest thing that would change your mind'),
    h('p', {}, rec.changeMind.text),
  ]);

  // Export controls.
  const copyBtn = h('button', { class: 'btn', type: 'button' }, 'Copy result as markdown');
  copyBtn.addEventListener('click', async () => {
    const md = resultMarkdown({ meta: rec.meta, scores, flags, rec, answers, project });
    await copyText(md, copyBtn, 'Copy result as markdown');
  });
  const csvBtn = h('button', { class: 'btn', type: 'button', onclick: downloadCsv }, 'Download log as CSV');

  return h('div', { class: 'view view-result' }, [
    h('div', { class: 'result-head' }, [
      h('div', {}, [
        h('h1', {}, project.projectName || 'Untitled project'),
        h('p', { class: 'result-sub' }, `${project.team || '—'} · ${project.date}`),
      ]),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => render('assessment') }, 'New assessment'),
    ]),
    flagBlock,
    h('div', { class: 'result-grid' }, [matrix, h('div', { class: 'result-col' }, [scoresBlock, accessBlock])]),
    recBlock,
    changeMind,
    project.notes ? h('div', { class: 'result-notes' }, [h('strong', {}, 'Also noted: '), project.notes]) : null,
    h('div', { class: 'export-bar' }, [copyBtn, csvBtn, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => render('log') }, 'View log →')]),
    h('p', { class: 'disclaimer' }, 'This is the opening position for a kickoff conversation, not a ruling. Bring it to the team.'),
  ]);
}

// --- log view ---------------------------------------------------------------

const QUAD_LABEL = { INVEST: 'INVEST', VERIFY: 'VERIFY', EXPLORE_CHEAP: 'EXPLORE CHEAP', SHIP: 'SHIP' };
let logSort = { key: 'timestamp', dir: 'desc' };

function renderLogView() {
  const entries = loadLog();
  const stats = summarize(entries);

  const summary = h('div', { class: 'log-summary' }, [
    summaryStat('Total assessments', stats.total),
    summaryStat('INVEST / VERIFY', `${stats.byQuadrant.INVEST} / ${stats.byQuadrant.VERIFY}`),
    summaryStat('EXPLORE / SHIP', `${stats.byQuadrant.EXPLORE_CHEAP} / ${stats.byQuadrant.SHIP}`),
    summaryStat('Overridden', stats.overridden, 'recommended ≠ method used'),
    summaryStat('Access-gap flags', stats.accessGaps, 'the recruitment case, quantified'),
    calibrationStat(stats.calibration),
  ]);

  if (!entries.length) {
    return h('div', { class: 'view view-log' }, [
      h('div', { class: 'result-head' }, [
        h('h1', {}, 'Assessment log'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => render('assessment') }, 'New assessment'),
      ]),
      h('p', { class: 'empty' }, 'No assessments yet. The log fills up as you run triage — and that’s where the calibration evidence comes from.'),
    ]);
  }

  const sorted = sortEntries(entries, logSort);
  const table = buildLogTable(sorted);

  return h('div', { class: 'view view-log' }, [
    h('div', { class: 'result-head' }, [
      h('div', {}, [h('h1', {}, 'Assessment log'), h('p', { class: 'result-sub' }, `${entries.length} assessment${entries.length === 1 ? '' : 's'}`)]),
      h('div', { class: 'log-actions' }, [
        h('button', { class: 'btn', type: 'button', onclick: downloadCsv }, 'Download CSV'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => render('assessment') }, 'New assessment'),
      ]),
    ]),
    summary,
    h('div', { class: 'table-scroll' }, table),
  ]);
}

function summaryStat(label, value, sub) {
  return h('div', { class: 'stat' }, [
    h('span', { class: 'stat-value' }, String(value)),
    h('span', { class: 'stat-label' }, label),
    sub ? h('span', { class: 'stat-sub' }, sub) : null,
  ]);
}

function calibrationStat(cal) {
  // The point of the whole log: of high-confidence calls, how many went badly?
  let value = '—';
  let sub = 'high-confidence calls with a known outcome';
  if (cal.highConfidenceCount === 0) {
    sub = 'no confidence ≥ 8 assessments yet';
  } else if (cal.resolvedCount === 0) {
    value = '?';
    sub = `${cal.highConfidenceCount} at confidence ≥ 8, none resolved yet`;
  } else {
    value = `${cal.percentBad}%`;
    sub = `of ${cal.resolvedCount} resolved confidence-≥8 calls hit significant issues`;
  }
  return h('div', { class: 'stat stat-calibration' }, [
    h('span', { class: 'stat-value' }, value),
    h('span', { class: 'stat-label' }, 'Calibration'),
    h('span', { class: 'stat-sub' }, sub),
  ]);
}

function sortEntries(entries, sort) {
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    let av = a[sort.key];
    let bv = b[sort.key];
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
    return ((av ?? 0) < (bv ?? 0) ? -1 : (av ?? 0) > (bv ?? 0) ? 1 : 0) * dir;
  });
}

function buildLogTable(entries) {
  const cols = [
    { key: 'timestamp', label: 'Date' },
    { key: 'projectName', label: 'Project' },
    { key: 'team', label: 'Team' },
    { key: 'quadrant', label: 'Quadrant' },
    { key: 'confidence', label: 'Conf' },
    { key: 'risk', label: 'Risk' },
    { key: 'access', label: 'Access' },
    { key: 'recommendedMethod', label: 'Recommended' },
  ];

  const headCells = cols.map((c) =>
    h(
      'th',
      {
        class: `sortable${logSort.key === c.key ? ' sorted-' + logSort.dir : ''}`,
        onclick: () => {
          logSort = { key: c.key, dir: logSort.key === c.key && logSort.dir === 'desc' ? 'asc' : 'desc' };
          render('log');
        },
      },
      c.label
    )
  );
  headCells.push(h('th', {}, 'Method actually used'), h('th', {}, 'Outcome'), h('th', {}, ''));

  const rows = entries.map((e) => {
    const methodInput = h('input', {
      type: 'text',
      class: 'cell-input',
      value: e.methodUsed || '',
      placeholder: '(filled in after kickoff)',
    });
    methodInput.addEventListener('change', () => updateEntry(e.id, { methodUsed: methodInput.value }));

    const outcomeSelect = h(
      'select',
      { class: 'cell-input' },
      OUTCOME_OPTIONS.map((o) => h('option', { value: o, selected: e.outcome === o }, o))
    );
    outcomeSelect.addEventListener('change', () => {
      updateEntry(e.id, { outcome: outcomeSelect.value });
      render('log'); // recompute calibration live
    });

    const outcomeNotes = h('input', {
      type: 'text',
      class: 'cell-input cell-input-sm',
      value: e.outcomeNotes || '',
      placeholder: 'notes',
    });
    outcomeNotes.addEventListener('change', () => updateEntry(e.id, { outcomeNotes: outcomeNotes.value }));

    const del = h('button', { class: 'link-danger', type: 'button', title: 'Delete', onclick: () => {
      if (confirm('Delete this assessment from the log?')) { deleteEntry(e.id); render('log'); }
    } }, '✕');

    const overridden = e.methodUsed && e.methodUsed.trim() && e.methodUsed.trim() !== e.recommendedMethod;

    return h('tr', {}, [
      h('td', { class: 'nowrap' }, (e.timestamp || '').slice(0, 10)),
      h('td', {}, e.projectName || '—'),
      h('td', {}, e.team || '—'),
      h('td', {}, h('span', { class: `quad-pill quad-${e.quadrant}` }, QUAD_LABEL[e.quadrant] || e.quadrant)),
      h('td', { class: 'num' }, String(e.confidence)),
      h('td', { class: 'num' }, String(e.risk)),
      h('td', { class: 'num' }, String(e.access)),
      h('td', { class: `rec-cell${overridden ? ' is-overridden' : ''}` }, e.recommendedMethod || '—'),
      h('td', {}, methodInput),
      h('td', {}, [outcomeSelect, outcomeNotes]),
      h('td', { class: 'nowrap' }, del),
    ]);
  });

  return h('table', { class: 'log-table' }, [h('thead', {}, h('tr', {}, headCells)), h('tbody', {}, rows)]);
}

// --- exports / clipboard ----------------------------------------------------

async function copyText(text, btn, restore) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for environments without the async clipboard API.
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* give up quietly */ }
    ta.remove();
  }
  const original = restore;
  btn.textContent = 'Copied ✓';
  setTimeout(() => { btn.textContent = original; }, 1600);
}

function downloadCsv() {
  const csv = toCsv(loadLog());
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `research-triage-log-${todayISO()}.csv` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- boot -------------------------------------------------------------------

document.querySelectorAll('[data-nav]').forEach((b) => {
  b.addEventListener('click', () => render(b.dataset.nav));
});

render('assessment');

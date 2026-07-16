// Result → markdown. This is how the result actually travels: pasted into Slack,
// a doc, a ticket. Keep it faithful to the on-screen result (spec §5.9), including
// the designer's own inputs next to the recommendation — that's the whole point.

import { QUESTION_BY_ID } from './questions.js';
import { SCORE_DEFINITIONS } from './recommend.js';

const RISK_QS = ['q6', 'q7', 'q9'];
const CONFIDENCE_QS = ['q1', 'q2', 'q3', 'q4'];

export function resultMarkdown(result) {
  const { meta, scores, flags, rec, answers, project } = result;
  const lines = [];

  lines.push(`# Research triage — ${project.projectName || 'Untitled'}`);
  lines.push('');
  lines.push(`**Team / designer:** ${project.team || '—'}  `);
  lines.push(`**Date:** ${project.date}  `);
  lines.push(`**Quadrant:** ${meta.short} — ${meta.name}. ${meta.tagline}`);
  lines.push('');

  if (flags.length) {
    lines.push('## Flags');
    for (const f of flags) {
      lines.push(`- **${f.level === 'flag' ? 'Flag' : 'Note'} — ${f.title}:** ${f.text}`);
    }
    lines.push('');
  }

  lines.push('## Scores');
  lines.push(`- **RISK: ${scores.risk} / 10** — _${SCORE_DEFINITIONS.RISK}_`);
  for (const id of RISK_QS) lines.push(`  - ${QUESTION_BY_ID[id].text} → **${answers[id]}**`);
  lines.push(`- **CONFIDENCE: ${scores.confidence} / 10** — _${SCORE_DEFINITIONS.CONFIDENCE}_`);
  for (const id of CONFIDENCE_QS) {
    const note = id === 'q4' ? ' _(inverted in scoring)_' : '';
    lines.push(`  - ${QUESTION_BY_ID[id].text} → **${answers[id]}**${note}`);
  }
  lines.push('');

  lines.push('## Access');
  lines.push(`**${rec.access.title}** — ${rec.access.text}`);
  lines.push('');

  lines.push(`## ${meta.name}`);
  lines.push(meta.description);
  lines.push('');

  lines.push('### Possible methodologies — pick from the trade-offs');
  for (const m of rec.methods) {
    lines.push(`- **${m.label}**`);
    lines.push(`  - Buys: ${m.buys}`);
    lines.push(`  - Leaves unanswered: ${m.leaves}`);
  }
  lines.push('');

  lines.push('## The cheapest thing that would change your mind');
  lines.push(`> ${rec.changeMind.text}`);
  lines.push('');

  if (project.notes && project.notes.trim()) {
    lines.push('## Anything else');
    lines.push(project.notes.trim());
    lines.push('');
  }

  lines.push('---');
  lines.push('_This is a proposal for a kickoff conversation, not a verdict._');

  return lines.join('\n');
}

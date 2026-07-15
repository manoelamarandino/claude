// Flag computation. Pure. Flags render ABOVE the recommendation — they are the
// things worth saying first. Each flag is { id, level, title, text }.
//   level: 'note'  → soft, worth naming
//          'flag'  → stop and read this
// Order in the returned array is the order they should render. See spec §4.

export function computeFlags(a, scores) {
  const flags = [];
  const { confidence, risk, access } = scores;

  // Unvalidated problem (Q1 <= 4). Put this near the top: whatever the method,
  // the bigger question is whether the problem is real.
  if (a.q1 <= 4) {
    flags.push({
      id: 'unvalidated-problem',
      level: 'flag',
      title: 'Unvalidated problem',
      text:
        'Problem confidence is low. Whatever we do about this design, the more important ' +
        'question is whether we’re solving a real problem. Consider discovery before evaluation.',
    });
  }

  // Access gap (ACCESS < 4 AND RISK >= 5.5). This is the mechanism that turns
  // every blocked study into evidence for building recruitment infrastructure.
  if (access < 4 && risk >= 5.5) {
    flags.push({
      id: 'access-gap',
      level: 'flag',
      title: 'Access gap — logged',
      text:
        'This needs real users and we can’t reach any right now. That’s a research ops ' +
        'problem, not a study design problem — logging it. In the meantime, here’s the ' +
        'best available approach with proxies.',
    });
  }

  // Confidence contradiction (Q5 >= 8 AND CONFIDENCE >= 7).
  if (a.q5 >= 8 && confidence >= 7) {
    flags.push({
      id: 'confidence-contradiction',
      level: 'flag',
      title: 'Confidence contradiction',
      text:
        'The team scored high confidence but also high disagreement. Those can’t both be ' +
        'true — someone’s confidence isn’t shared. Worth resolving before anything else.',
    });
  }

  // Novelty trap (Q4 >= 8 AND Q3 >= 7).
  if (a.q4 >= 8 && a.q3 >= 7) {
    flags.push({
      id: 'novelty-trap',
      level: 'flag',
      title: 'Novelty trap',
      text:
        'This is a novel interaction and the team is confident in it. That combination is ' +
        'the most common source of surprise findings — confidence in an unfamiliar pattern ' +
        'is usually untested confidence.',
    });
  }

  // Disagreement (Q5). Note at 5–7, flag at 8–10, nothing at 1–4.
  if (a.q5 >= 8) {
    flags.push({
      id: 'disagreement',
      level: 'flag',
      title: 'Team is split',
      text:
        'The team is split on this design. High disagreement plus a request to test usually ' +
        'means research is being asked to settle an argument. Research can tell you what users ' +
        'do — it can’t tell you who’s right about what to build. Name the disagreement before ' +
        'scoping the study.',
    });
  } else if (a.q5 >= 5) {
    flags.push({
      id: 'disagreement',
      level: 'note',
      title: 'Some disagreement',
      text: 'There’s some disagreement on the team about this design. Worth naming at kickoff.',
    });
  }

  return flags;
}

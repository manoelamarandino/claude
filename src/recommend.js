// Recommendation logic. Pure. Turns scores + raw answers into a proposal:
// a menu of possible methodologies for the quadrant (each with its trade-off),
// an access adjustment, and the single most valuable line — the cheapest thing
// that would change your mind.
//
// There is deliberately NO single "recommended" method. Triage is a choice from
// a menu, not a verdict, so every methodology names what it BUYS and what it
// LEAVES UNANSWERED, and the team picks based on the trade-off.
//
// Internal quadrant IDs (INVEST / VERIFY / EXPLORE_CHEAP / SHIP) are kept stable
// so the saved log and calibration keep working; only the display names change.

export const QUADRANTS = {
  // Low confidence, high risk.
  INVEST: {
    id: 'INVEST',
    name: 'Needs more exploration',
    short: 'DISCOVER',
    tagline: 'Low confidence, high risk — step back before committing.',
    description:
      'We’re not confident in what we’re proposing, and the cost of getting it wrong is high. This is ' +
      'the quadrant where the honest move might be to slow down — or even suggest changing the project. ' +
      'Explore the problem properly before betting on this design.',
    methods: [
      {
        label: 'Dealership visits (contextual observation)',
        buys: 'First-hand context — how people really behave in the real setting, not how we picture it.',
        leaves: 'It’s observation of the problem space, not proof this design solves it.',
      },
      {
        label: 'Discovery interviews (4–6 users)',
        buys: 'Whether we’re solving a real problem, and what actually matters to the people who have it.',
        leaves: 'Nothing yet about whether this specific design is the right answer.',
      },
      {
        label: 'Workshops with users or SMEs (subject-matter experts)',
        buys: 'A lot of ground on needs, edge cases and constraints fast, with shared understanding in the room.',
        leaves: 'Group settings can bury quiet disagreement — it’s input, not evidence of real use.',
      },
      {
        label: 'Build a complete user journey',
        buys: 'The end-to-end picture: where this design sits and which moments actually carry the risk.',
        leaves: 'Maps the terrain; doesn’t test whether the design works at any single step.',
      },
    ],
  },

  // High confidence, high risk.
  VERIFY: {
    id: 'VERIFY',
    name: 'Confirm',
    short: 'CONFIRM',
    tagline: 'High confidence, high risk — check before you commit.',
    description:
      'We’re fairly sure this is right, but the stakes are real: ship without checking and something ' +
      'could break or move a financial metric. Do enough discovery to confirm — you don’t need to go as ' +
      'deep as DISCOVER. Short on time? A few interviews to raise confidence is enough.',
    methods: [
      {
        label: 'Moderated interviews / usability sessions (3–5 users)',
        buys: 'Live confirmation on the riskiest task, with room to probe the “why”.',
        leaves: 'Small sample, deliberately narrow — it confirms a belief, it won’t explore broadly.',
      },
      {
        label: 'Build a complete user journey',
        buys: 'Pinpoints exactly which moment carries the risk so you can aim the check.',
        leaves: 'Heavier than a confirm usually needs — skip it if time is short.',
      },
      {
        label: 'SME (subject-matter expert) interviews',
        buys: 'A fast confidence boost from people who do this every day.',
        leaves: 'A proxy for users, not the users themselves.',
      },
    ],
  },

  // Low confidence, low risk.
  EXPLORE_CHEAP: {
    id: 'EXPLORE_CHEAP',
    name: 'Explore cheap',
    short: 'EXPLORE CHEAP',
    tagline: 'Low confidence, low risk — learn fast, learn cheap.',
    description:
      'We’re unsure of the path, but the worst case is mild user dissatisfaction — nothing breaks, no ' +
      'financial metric moves, and we can reverse or improve it later. Keep it quick and cheap.',
    methods: [
      {
        label: 'Unmoderated usability tests',
        buys: 'Quick behavioural signal at low cost, no scheduling.',
        leaves: 'No room to ask “why” when something surprises you.',
      },
      {
        label: 'Talks with SMEs (subject-matter experts)',
        buys: 'A fast expert read on the obvious problems, zero recruitment.',
        leaves: 'Expert opinion, not real user behaviour.',
      },
      {
        label: 'Quick chat with users — only if readily available',
        buys: 'A dose of real-user reality without the delay.',
        leaves: 'Not worth waiting months for at this low risk — if they’re not to hand, skip it.',
      },
      {
        label: 'Heuristic evaluation (paired with another method)',
        buys: 'Cheap coverage of common usability issues to round out the above.',
        leaves: 'On its own it catches known pitfalls, not the surprises specific to your users.',
      },
    ],
  },

  // High confidence, low risk.
  SHIP: {
    id: 'SHIP',
    name: 'Ship it ASAP',
    short: 'SHIP',
    tagline: 'High confidence, low risk — don’t hold it up.',
    description:
      'We’re confident and the downside is small — it won’t dent the user’s main Job to be Done, break ' +
      'systems, or move financial metrics. The research team’s job here is speed. Real usage data from a ' +
      'pilot or launch will be more reliable than anything we’d learn beforehand.',
    methods: [
      {
        label: 'Heuristic evaluation (on its own)',
        buys: 'A fast expert sanity pass this week — a second set of eyes, no recruitment, no delay.',
        leaves: 'Expert judgment, not real behaviour — fine at this low risk.',
      },
      {
        label: 'Unmoderated usability tests',
        buys: 'A quick behavioural gut-check if you want one, still no scheduling.',
        leaves: 'Won’t surface much you don’t already expect at this confidence.',
      },
      {
        label: 'Unmoderated interviews with SMEs (subject-matter experts)',
        buys: 'Light reassurance from experts, asynchronously.',
        leaves: 'Proxy input; the real signal comes once users are actually in it.',
      },
    ],
  },
};

// Short labels for the matrix grid, keyed by quadrant id. Single source of
// truth so the matrix and the rest of the app never drift apart.
export const QUADRANT_SHORT = Object.fromEntries(
  Object.values(QUADRANTS).map((q) => [q.id, q.short])
);

// Plain-language definitions of the two axes, shown on the result screen.
export const SCORE_DEFINITIONS = {
  CONFIDENCE: 'How confident are we that this is the right solution to the right problem?',
  RISK: 'If the solution doesn’t perform as expected with users, how much does it impact their main Job to be Done?',
};

// Adjust for the access band. Returns an { title, text } note. Access is scored
// and flagged separately; this is the plain-language read for the result screen.
function accessAdjustment(band) {
  if (band === 'open') {
    return {
      title: 'Access: Open',
      text: 'Any method is viable — you can reach real users. No adjustment needed.',
    };
  }
  if (band === 'constrained') {
    return {
      title: 'Access: Constrained',
      text:
        'Real users are reachable but scarce. Favour the lighter methods above, lean on proxies where a ' +
        'proxy will do, and save real-user sessions for the riskiest question.',
    };
  }
  return {
    title: 'Access: Blocked',
    text:
      'Real users are off the table this cycle. Run the closest proxy-based methods above — SMEs, CS, ' +
      'implementation, trainers — and log the recruitment gap so it counts toward the case for standing ' +
      'recruitment infrastructure.',
  };
}

// The cheapest thing that would change your mind. Derived from the biggest
// genuine uncertainty — the lowest-scoring CONFIDENCE contributor. "Change your
// mind" means resolving an uncertainty, and uncertainty lives on the confidence
// axis (risk questions are known stakes, not open questions). Q4 is inverted to
// its confidence contribution (11 - Q4) so novelty is compared on the same
// "how sure are we" footing as the rest.
const CHANGE_MY_MIND = {
  q1: 'Talk to 3 users or skim 10 support tickets to confirm this problem is real — that’s the biggest open question here.',
  q2: 'Watch 2 users do this task the way they do it today; even a 20-minute call each would resolve the biggest gap.',
  q3: 'Run a 45-minute design critique, or check whether this is a pattern users already know — that’s the cheapest way to test the approach.',
  q4: 'Put the novel interaction in front of 2–3 users and watch them form the mental model — novelty is the biggest unknown here.',
};

export function cheapestThingToChangeMind(a) {
  const contributors = [
    { id: 'q1', value: a.q1 },
    { id: 'q2', value: a.q2 },
    { id: 'q3', value: a.q3 },
    { id: 'q4', value: 11 - a.q4 }, // inverted to its confidence contribution
  ];
  // Lowest contribution wins; ties break toward the earlier (more fundamental)
  // question, since the array is already in Q1→Q4 order.
  let lowest = contributors[0];
  for (const c of contributors) {
    if (c.value < lowest.value) lowest = c;
  }
  return { questionId: lowest.id, text: CHANGE_MY_MIND[lowest.id] };
}

// Full recommendation bundle for the result screen.
export function recommend(a, scores) {
  const quad = QUADRANTS[scores.quadrant];
  return {
    meta: {
      id: quad.id,
      name: quad.name,
      short: quad.short,
      tagline: quad.tagline,
      description: quad.description,
    },
    methods: quad.methods,
    access: accessAdjustment(scores.band),
    changeMind: cheapestThingToChangeMind(a),
  };
}

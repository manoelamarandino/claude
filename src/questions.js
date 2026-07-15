// The 11-question set. All 1–10 sliders. Anchors are essential, not decorative.
// Grouped into 4 blocks. Order and wording are deliberate — see the build spec §1.
// Nothing here computes anything; this module is pure data so the copy lives in
// one place and the scoring engine never has to know about wording.

export const BLOCKS = [
  {
    id: 'problem-confidence',
    title: 'Problem confidence',
    blurb: 'How sure are we the problem is real?',
    questions: [
      {
        id: 'q1',
        text: 'How confident are we that the problem this design solves is real for the user?',
        low: "We're assuming it",
        high: 'We have research, support tickets, or usage data proving it',
      },
      {
        id: 'q2',
        text: 'How well do we understand how users do this today — their current workflow, workarounds, and context?',
        low: "We're guessing",
        high: "We've watched them do it",
      },
    ],
  },
  {
    id: 'solution-confidence',
    title: 'Solution confidence',
    blurb: 'How sure are we this design is the right answer?',
    questions: [
      {
        id: 'q3',
        text: 'How confident are we that this specific design is the right approach to solving it?',
        low: "It's our first guess",
        high: "We've validated the concept, or it's a proven pattern users already know",
      },
      {
        id: 'q4',
        text: 'How novel is this interaction for our users?',
        low: "Standard pattern they've used a hundred times",
        high: 'A new mental model for them',
        note: 'Inverted in scoring — high novelty reduces confidence.',
      },
      {
        id: 'q5',
        text: 'How much internal disagreement is there about this design?',
        low: 'The team is aligned',
        high: "We're split, and this test is meant to settle it",
        note: 'Not scored. Raises a flag only.',
      },
    ],
  },
  {
    id: 'risk',
    title: 'Risk',
    blurb: 'How much does it cost us to be wrong?',
    questions: [
      {
        id: 'q6',
        text: 'If we get this wrong, how badly does it hurt the user?',
        low: 'Mild annoyance, it looks dated',
        high: "They can't complete their core task, or they make a costly error",
      },
      {
        id: 'q7',
        text: 'How hard would it be to fix after launch?',
        low: 'Config change or feature flag, days',
        high: 'Re-architecture or release train, months',
      },
      {
        id: 'q8',
        text: 'How much business exposure is there? (revenue, compliance, contractual, reputational)',
        low: 'Negligible',
        high: 'Regulatory, contractual, or a named-account risk',
      },
      {
        id: 'q9',
        text: 'How many users does this touch?',
        low: 'A niche subset',
        high: 'Nearly everyone on the product',
      },
    ],
  },
  {
    id: 'access',
    title: 'Access reality',
    blurb: 'Who can we actually talk to?',
    questions: [
      {
        id: 'q10',
        text: 'How many real users could we realistically talk to in the next two weeks?',
        low: "Zero, we'd start recruitment from scratch",
        high: 'We have a list of willing participants ready now',
      },
      {
        id: 'q11',
        text: 'If we can’t reach real users, do we have credible proxies? (internal SMEs, CS, implementation, trainers)',
        low: 'Nobody',
        high: 'Several people who do this work daily or sit with users constantly',
      },
    ],
  },
];

// Flat list of all questions, handy for iteration and validation.
export const QUESTIONS = BLOCKS.flatMap((b) => b.questions);
export const QUESTION_IDS = QUESTIONS.map((q) => q.id);

// Lookup by id, e.g. QUESTION_BY_ID.q6.text
export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

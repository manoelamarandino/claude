// Recommendation logic. Pure. Turns scores + raw answers into a proposal:
// a primary method, alternatives, an access adjustment, and the single most
// valuable line — the cheapest thing that would change your mind.
//
// Framing that matters (spec intro + §5): the output is NOT a verdict. It's the
// opening position for a kickoff conversation. Copy here should sound like a
// researcher who wants to help the team move fast, never a gatekeeper.

export const QUADRANT_META = {
  INVEST: {
    label: 'INVEST',
    tagline: 'High risk, low confidence — the real thing.',
    blurb:
      'This is where full studies are justified. Don’t compress it — this is the quadrant ' +
      'the whole tool exists to protect budget for.',
  },
  VERIFY: {
    label: 'VERIFY',
    tagline: 'High risk, high confidence — confirm the belief.',
    blurb:
      'Confidence is high but the cost of being wrong is real. You’re confirming a specific ' +
      'belief, not exploring — so scope tightly.',
  },
  EXPLORE_CHEAP: {
    label: 'EXPLORE CHEAP',
    tagline: 'Low risk, low confidence — learn fast, learn cheap.',
    blurb:
      'Uncertain, but the downside is small. Learn cheaply, or just learn in production. ' +
      'Post-launch data may be cheaper than pre-launch research here.',
  },
  SHIP: {
    label: 'SHIP',
    tagline: 'Low risk, high confidence — here’s the fast thing you get.',
    blurb:
      'You’re in good shape. The research team’s contribution here is speed, not scrutiny — ' +
      'a fast heuristic pass this week so you can move with a second set of eyes on it.',
  },
};

// Primary method + alternatives per quadrant. Each alternative names what it
// buys and what it leaves unanswered (spec §5.7).
function baseRecommendation(quadrant, a) {
  switch (quadrant) {
    case 'INVEST': {
      // If problem confidence is also low, don't test a solution to an
      // unvalidated problem — that's theatre. Discovery comes first.
      const problemShaky = a.q1 <= 4 || a.q2 <= 4;
      if (problemShaky) {
        return {
          primary: {
            method: 'Discovery first — then decide whether to evaluate',
            detail:
              'Problem confidence is low, so a usability study would be testing a solution to a ' +
              'problem we haven’t validated. Start with 4–6 discovery conversations or a review of ' +
              'existing tickets/usage data. If the problem holds up, come back and run the full study.',
          },
          alternatives: [
            {
              label: 'Moderated usability study, 5–8 real users',
              buys: 'The full evaluative picture, once the problem is validated.',
              leaves: 'Premature if the problem itself turns out to be assumed.',
            },
            {
              label: 'Discovery interviews (4–6 users)',
              buys: 'Whether this problem is worth solving at all.',
              leaves: 'Says nothing yet about whether this design solves it.',
            },
          ],
        };
      }
      return {
        primary: {
          method: 'Moderated usability study with real users (5–8 participants)',
          detail:
            'The real thing. High risk and low confidence together is exactly what a full study is ' +
            'for. Don’t compress this one — protect the time for it.',
        },
        alternatives: [
          {
            label: 'Moderated study, tighter (5 participants)',
            buys: 'Most of the signal at a smaller recruit.',
            leaves: 'Thinner coverage of edge cases and less-common paths.',
          },
          {
            label: 'Unmoderated study + follow-up interviews',
            buys: 'Scale on the task flow, depth on the surprises.',
            leaves: 'Weaker for anything needing live probing or context.',
          },
        ],
      };
    }
    case 'VERIFY':
      return {
        primary: {
          method: 'Focused usability test, 3–5 participants, riskiest task only',
          detail:
            'Confidence is high but the stakes are real, so confirm. Point it at the single riskiest ' +
            'task and nothing else — you’re confirming a belief, not exploring.',
        },
        alternatives: [
          {
            label: 'Unmoderated test (UserTesting-style)',
            buys: 'Fast confirmation if the flow is self-explanatory.',
            leaves: 'No room to probe the "why" when something goes sideways.',
          },
          {
            label: 'Moderated, 3 users on the one risky task',
            buys: 'Live probing on the exact thing you’re worried about.',
            leaves: 'Deliberately blind to everything outside that task.',
          },
        ],
      };
    case 'EXPLORE_CHEAP':
      return {
        primary: {
          method: 'Heuristic evaluation + 2–3 proxy users',
          detail:
            'Uncertain, but the downside is small. Get a quick expert read plus a couple of proxy ' +
            'users, and treat production data as a legitimate next source of truth.',
        },
        alternatives: [
          {
            label: 'Ship behind a flag and instrument it',
            buys: 'Real behaviour at real scale, post-launch, cheaply.',
            leaves: 'You learn after shipping, not before — fine when risk is low.',
          },
          {
            label: 'Design critique / cognitive walkthrough with the team',
            buys: 'Same-day structured feedback, zero recruitment.',
            leaves: 'It’s the team’s judgement, not a user’s behaviour.',
          },
        ],
      };
    case 'SHIP':
    default:
      return {
        primary: {
          method: 'Heuristic evaluation — 30–45 min, researcher-led, this week',
          detail:
            'You’re in good shape, so here’s the fast thing you get: a researcher-led heuristic pass ' +
            'this week. A second set of expert eyes, no recruitment, no delay to your timeline.',
        },
        alternatives: [
          {
            label: '1–2 proxy users as a sanity check',
            buys: 'Extra reassurance if the team wants it.',
            leaves: 'Won’t surface much you don’t already expect at this confidence.',
          },
          {
            label: 'Ship now, instrument the key task',
            buys: 'Zero delay, with a post-launch signal to watch.',
            leaves: 'You’d catch a problem after launch rather than before.',
          },
        ],
      };
  }
}

// Adjust the recommendation for the access band. Returns an { title, text }
// note; null when access is Open (any method is viable, nothing to say).
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
        'Real users are reachable but scarce. Favour the lighter end of the options above, lean on ' +
        'proxies where a proxy will do, and save real-user sessions for the riskiest question.',
    };
  }
  return {
    title: 'Access: Blocked',
    text:
      'Real users are off the table this cycle. Run the closest proxy-based version of the ' +
      'recommendation — SMEs, CS, implementation, trainers — and log the recruitment gap so it ' +
      'counts toward the case for standing recruitment infrastructure.',
  };
}

// The cheapest thing that would change your mind (spec §5.8). Derived from the
// biggest genuine uncertainty — the lowest-scoring CONFIDENCE contributor.
// "Change your mind" means resolving an uncertainty, and uncertainty lives on
// the confidence axis (risk questions are known stakes, not open questions).
// Q4 is inverted to its confidence contribution (11 - Q4) so novelty is
// compared on the same "how sure are we" footing as the rest.
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
  const base = baseRecommendation(scores.quadrant, a);
  return {
    meta: QUADRANT_META[scores.quadrant],
    primary: base.primary,
    alternatives: base.alternatives,
    access: accessAdjustment(scores.band),
    changeMind: cheapestThingToChangeMind(a),
  };
}

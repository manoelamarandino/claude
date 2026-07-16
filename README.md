# Research Triage Matrix

A single-page tool that helps a UX researcher triage incoming evaluative research
requests from designers.

**The problem it solves:** designers arrive with a finished prototype and say
"test this with users." Some of those requests genuinely need a usability study.
Many don't — but there's no shared language for saying so, and recruitment is
slow enough that saying yes to everything means everything takes months or gets
tested on the same handful of users repeatedly.

**How it works:** the designer answers 10 questions on 1–10 sliders. The app
computes a weighted **RISK** score and a weighted **CONFIDENCE** score, plots them
on a 2×2 matrix, checks a separate **ACCESS** constraint, and returns a
recommended research approach with reasoning.

**The output is not a verdict.** It's the opening position for a kickoff
conversation. The result screen shows the designer *their own inputs* next to the
recommendation, so the method reads as a consequence of what they said — not a
ruling handed down.

## Running it

It's a static site — no backend, no build step, no dependencies.

```bash
# Any static server works. This repo ships a tiny zero-dependency one:
npm start        # → http://localhost:5173
# or: python3 -m http.server 5173
```

Open the URL in a browser. (Because the app uses ES modules, it must be served
over HTTP — opening `index.html` directly via `file://` won't load the scripts.)

## Deploying

Push the repository as-is to any static host — Vercel, Netlify, GitHub Pages.
There is no build command and no output directory; the served root is the repo
root (`index.html` at the top level).

## Tests

The scoring engine, flags, and recommendation logic are pure functions with no
DOM or storage dependencies, unit-tested with node's built-in runner:

```bash
npm test
```

## How it's put together

Pure logic is separated from the DOM so it stays testable:

| File | Responsibility |
| --- | --- |
| `src/questions.js` | The 11-question set + anchor copy (pure data) |
| `src/scoring.js` | RISK / CONFIDENCE / ACCESS formulas + confidence override (pure) |
| `src/flags.js` | The five flags (pure) |
| `src/recommend.js` | Quadrant methods, access adjustment, "change your mind" (pure) |
| `src/markdown.js` | Result → markdown export (pure) |
| `src/matrix.js` | The 2×2 SVG |
| `src/storage.js` | `localStorage` log, summary/calibration, CSV export |
| `src/app.js` | View routing, form, result screen, log (the DOM glue) |

### The scoring (see the spec for the why)

```
RISK       = (Q6×0.5) + (Q7×0.375) + (Q9×0.125)

CONFIDENCE = (Q1×0.3) + (Q3×0.3) + (Q2×0.2) + ((11−Q4)×0.2)
             override: if Q1 ≤ 4, CONFIDENCE = min(CONFIDENCE, 5)

ACCESS     = max(Q10, Q11×0.7)
```

Both axes split at **5.5** — the true midpoint of a 1–10 scale.

|  | Low confidence (< 5.5) | High confidence (≥ 5.5) |
| --- | --- | --- |
| **High risk (≥ 5.5)** | INVEST | VERIFY |
| **Low risk (< 5.5)** | EXPLORE CHEAP | SHIP |

## The log

Every completed assessment saves to `localStorage` on this device (nothing is
sent anywhere). The log view lets the researcher fill in, later, the **method
actually used** and the **outcome** — and surfaces the number that turns a vibes
matrix into evidence:

> **Calibration** — of assessments scored CONFIDENCE ≥ 8, what % ended in
> "significant issues"?

Plus counts by quadrant, how often the recommendation was overridden, and how
many assessments hit the access gap (the recruitment-infrastructure argument,
quantified). Export the full log as CSV.

## Privacy

No backend, no accounts, no analytics, no external calls. All state lives in your
browser's `localStorage`.

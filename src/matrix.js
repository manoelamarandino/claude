// The matrix. It's the hero — it has to be legible from across a room in a
// kickoff meeting (spec §8). Rendered as SVG so it stays crisp when projected
// and screenshots cleanly. X axis = Confidence, Y axis = Risk (increasing up).
//
// The dot's position matters more than the quadrant name, so the dot is drawn
// large and last (on top of everything).

import { THRESHOLD } from './scoring.js';

const NS = 'http://www.w3.org/2000/svg';

// Viewbox geometry. Plot area is a square inside padded axes.
const W = 460;
const H = 460;
const PAD = 52; // room for axis labels
const PLOT = { x0: PAD, y0: PAD, x1: W - 24, y1: H - PAD };

// Map a 1–10 value to an x pixel (confidence: 1 left → 10 right).
function xOf(v) {
  return PLOT.x0 + ((v - 1) / 9) * (PLOT.x1 - PLOT.x0);
}
// Map a 1–10 value to a y pixel (risk: 1 bottom → 10 top, so invert).
function yOf(v) {
  return PLOT.y1 - ((v - 1) / 9) * (PLOT.y1 - PLOT.y0);
}

function el(name, attrs, text) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

// Build the SVG element. `active` is the current quadrant id, highlighted.
export function renderMatrix(confidence, risk, active) {
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'matrix-svg',
    role: 'img',
    'aria-label': `Confidence ${confidence} of 10, Risk ${risk} of 10, quadrant ${active}`,
  });

  const tx = xOf(THRESHOLD);
  const ty = yOf(THRESHOLD);

  // Quadrant fills. Coordinates: high risk = top, high confidence = right.
  const quads = [
    { id: 'INVEST', label: 'INVEST', x: PLOT.x0, y: PLOT.y0, w: tx - PLOT.x0, h: ty - PLOT.y0, lx: (PLOT.x0 + tx) / 2, ly: (PLOT.y0 + ty) / 2 },
    { id: 'VERIFY', label: 'VERIFY', x: tx, y: PLOT.y0, w: PLOT.x1 - tx, h: ty - PLOT.y0, lx: (tx + PLOT.x1) / 2, ly: (PLOT.y0 + ty) / 2 },
    { id: 'EXPLORE_CHEAP', label: 'EXPLORE CHEAP', x: PLOT.x0, y: ty, w: tx - PLOT.x0, h: PLOT.y1 - ty, lx: (PLOT.x0 + tx) / 2, ly: (ty + PLOT.y1) / 2 },
    { id: 'SHIP', label: 'SHIP', x: tx, y: ty, w: PLOT.x1 - tx, h: PLOT.y1 - ty, lx: (tx + PLOT.x1) / 2, ly: (ty + PLOT.y1) / 2 },
  ];

  for (const q of quads) {
    svg.appendChild(
      el('rect', {
        x: q.x,
        y: q.y,
        width: q.w,
        height: q.h,
        class: `matrix-quad${q.id === active ? ' is-active' : ''}`,
        'data-quad': q.id,
      })
    );
  }

  // Quadrant labels.
  for (const q of quads) {
    svg.appendChild(
      el(
        'text',
        {
          x: q.lx,
          y: q.ly,
          class: `matrix-quad-label${q.id === active ? ' is-active' : ''}`,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
        },
        q.label
      )
    );
  }

  // Threshold lines at 5.5 on both axes.
  svg.appendChild(el('line', { x1: tx, y1: PLOT.y0, x2: tx, y2: PLOT.y1, class: 'matrix-threshold' }));
  svg.appendChild(el('line', { x1: PLOT.x0, y1: ty, x2: PLOT.x1, y2: ty, class: 'matrix-threshold' }));

  // Plot frame.
  svg.appendChild(
    el('rect', { x: PLOT.x0, y: PLOT.y0, width: PLOT.x1 - PLOT.x0, height: PLOT.y1 - PLOT.y0, class: 'matrix-frame' })
  );

  // Axis titles.
  svg.appendChild(
    el('text', { x: (PLOT.x0 + PLOT.x1) / 2, y: H - 14, class: 'matrix-axis', 'text-anchor': 'middle' }, 'Confidence →')
  );
  const yLabel = el(
    'text',
    { x: 16, y: (PLOT.y0 + PLOT.y1) / 2, class: 'matrix-axis', 'text-anchor': 'middle', transform: `rotate(-90 16 ${(PLOT.y0 + PLOT.y1) / 2})` },
    'Risk →'
  );
  svg.appendChild(yLabel);

  // The dot. Drawn last so it sits on top; a halo makes it readable over any fill.
  const cx = xOf(clamp(confidence));
  const cy = yOf(clamp(risk));
  svg.appendChild(el('circle', { cx, cy, r: 12, class: 'matrix-dot-halo' }));
  svg.appendChild(el('circle', { cx, cy, r: 7, class: 'matrix-dot' }));

  return svg;
}

function clamp(v) {
  return Math.max(1, Math.min(10, v));
}

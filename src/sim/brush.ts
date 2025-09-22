// Brush tools that mutate the heightfield (and optionally moisture).
// Keep all grid math here so the worker can call into it directly.

import type { Brush } from "../model/types";

export type DirtyRect = { x0: number; y0: number; x1: number; y1: number };

type ClampOpts = { min?: number; max?: number };
const clamp = (v: number, { min = -Infinity, max = Infinity }: ClampOpts) =>
  v < min ? min : v > max ? max : v;

/**
 * Compute an axis-aligned bounding box for a circular brush stroke.
 * Expands by +1 to allow for smoothing kernels.
 */
export function strokeBounds(
  x: number,
  y: number,
  radius: number,
  size: number,
  pad = 1
): DirtyRect {
  const r = Math.max(1, Math.floor(radius));
  const x0 = clamp(Math.floor(x - r - pad), { min: 0 });
  const y0 = clamp(Math.floor(y - r - pad), { min: 0 });
  const x1 = clamp(Math.ceil(x + r + pad), { max: size - 1 });
  const y1 = clamp(Math.ceil(y + r + pad), { max: size - 1 });
  return { x0, y0, x1, y1 };
}

/**
 * Apply a circular brush stamp onto the heightfield.
 * - raise/lower: adds/subtracts a radial falloff (cosine) scaled by strength.
 * - smooth: local mean blend inside radius.
 * - rain: increases moisture in area (caller can use this to trigger flow/river recompute).
 *
 * @param height  Float32Array heightfield in [0,1]
 * @param moisture Optional Float32Array moisture field in [0,1]
 * @param size    Grid dimension (size x size)
 * @param cx,cy   Stroke center in grid coordinates (integers preferred, but not required)
 * @param brush   Brush definition { kind, radius, strength }
 * @returns       DirtyRect that changed (inclusive indices)
 */
export function applyBrush(
  height: Float32Array,
  moisture: Float32Array | undefined,
  size: number,
  cx: number,
  cy: number,
  brush: Brush
): DirtyRect {
  const { kind, radius, strength } = brush;
  const bounds = strokeBounds(cx, cy, radius, size, kind === "smooth" ? 2 : 1);

  switch (kind) {
    case "raise":
    case "lower": {
      const s = kind === "raise" ? +strength : -strength;
      radialAdd(height, size, cx, cy, radius, s);
      // Clamp the edited region to [0,1]
      clampRegion(height, size, bounds, 0, 1);
      break;
    }
    case "smooth": {
      smoothRegion(height, size, bounds, radius, strength);
      clampRegion(height, size, bounds, 0, 1);
      break;
    }
    case "rain": {
      if (moisture) {
        radialAdd(moisture, size, cx, cy, radius, strength);
        clampRegion(moisture, size, bounds, 0, 1);
      }
      break;
    }
  }

  return bounds;
}

/* ---------- helpers ---------- */

/**
 * Add a radial falloff “stamp” to a scalar field.
 * Falloff uses a smooth cosine curve: f(d) = 0.5*(1+cos(pi * d/r)) for d<=r else 0.
 * delta = strength * f.
 */
function radialAdd(
  field: Float32Array,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  strength: number
) {
  const r2 = radius * radius;
  const piOverR = Math.PI / radius;

  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(size - 1, Math.ceil(cx + radius));
  const y1 = Math.min(size - 1, Math.ceil(cy + radius));

  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      const falloff = 0.5 * (1 + Math.cos(piOverR * d)); // 1 at center, 0 at edge
      const idx = y * size + x;
      field[idx] += strength * falloff;
    }
  }
}

/**
 * Simple box blur blend inside bounds. We blend original→blurred by 'alpha'.
 * - `kernelRadius` controls blur radius (in pixels).
 * - `alpha` in [0,1] controls how strongly to move toward blurred value.
 * NOTE: To avoid allocations, we reuse a temporary line buffer.
 */
function smoothRegion(
  field: Float32Array,
  size: number,
  bounds: DirtyRect,
  kernelRadius: number,
  alpha: number
) {
  const { x0, y0, x1, y1 } = bounds;
  const k = Math.max(1, Math.floor(kernelRadius));
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;

  // Horizontal pass: running sum per row
  const tmp = new Float32Array(w * h);

  for (let y = y0, ry = 0; y <= y1; y++, ry++) {
    let sum = 0;
    // prime the window
    for (let x = x0 - k; x <= x0 + k; x++) {
      const xi = clamp(x, { min: 0, max: size - 1 });
      sum += field[y * size + xi];
    }
    const norm = 1 / (2 * k + 1);
    for (let x = x0, rx = 0; x <= x1; x++, rx++) {
      const left = x - k - 1;
      const right = x + k;
      const li = clamp(left, { min: 0, max: size - 1 });
      const ri = clamp(right, { min: 0, max: size - 1 });
      // slide
      if (left >= 0) sum -= field[y * size + li];
      if (right < size) sum += field[y * size + ri];
      tmp[ry * w + rx] = sum * norm;
    }
  }

  // Vertical pass: running sum per column, then blend into original
  for (let x = 0; x < w; x++) {
    let sum = 0;
    // prime
    for (let y = y0 - k; y <= y0 + k; y++) {
      const yi = clamp(y, { min: 0, max: size - 1 }) - y0;
      sum += tmp[yi * w + x];
    }
    const norm = 1 / (2 * k + 1);
    for (let y = y0, ry = 0; y <= y1; y++, ry++) {
      const top = ry - k - 1;
      const bot = ry + k;
      const ti = clamp(top, { min: 0, max: h - 1 });
      const bi = clamp(bot, { min: 0, max: h - 1 });
      if (top >= 0) sum -= tmp[ti * w + x];
      if (bot < h) sum += tmp[bi * w + x];
      const blurred = sum * norm;
      const idx = y * size + (x0 + x);
      field[idx] = field[idx] * (1 - alpha) + blurred * alpha;
    }
  }
}

function clampRegion(
  field: Float32Array | Uint8Array,
  size: number,
  rect: DirtyRect,
  min: number,
  max: number
) {
  const { x0, y0, x1, y1 } = rect;
  for (let y = y0; y <= y1; y++) {
    const row = y * size;
    for (let x = x0; x <= x1; x++) {
      const i = row + x;
      const v = field[i] as number;
      const c = v < min ? min : v > max ? max : v;
      (field as any)[i] = c;
    }
  }
}

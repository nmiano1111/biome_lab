// Deterministic 2D value-noise + fBM + domain warp.
// Keep the math here and call it from the worker for height generation.

import type { SimParams, NoiseParams } from "../model/types";

/** Simple, fast deterministic PRNG */
export function xorshift32(seed: number) {
  let s = seed >>> 0 || 1; // avoid zero
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17; s >>>= 0;
    s ^= s << 5;  s >>>= 0;
    // 0..1 (exclusive of 1)
    return (s >>> 0) / 4294967296;
  };
}

/** Quintic fade (smoother than cubic) */
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Lattice hash: generate repeatable pseudo-random values at integer lattice points.
 * Uses a small permutation table seeded once.
 */
export class ValueNoise2D {
  private perm: Uint16Array; // 0..255 shuffled
  constructor(seed: number) {
    const rng = xorshift32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    const perm = new Uint16Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    this.perm = perm;
  }

  /** Hash to [0,1) at integer lattice point */
  private lattice(ix: number, iy: number) {
    // 2D hash via perm table
    return (this.perm[ix & 255] + iy) & 255;
  }

  /** Value at lattice point mapped to [0,1) */
  private val(ix: number, iy: number) {
    // Convert hash to 0..1 via perm again (cheap)
    return this.perm[this.lattice(ix, iy)] / 255;
  }

  /**
   * Sample value noise at (x,y) with scalar frequency (world units per pixel ~ 1/freq).
   * Returns in [0,1].
   */
  sample(x: number, y: number, frequency = 1): number {
    const fx = x * frequency;
    const fy = y * frequency;

    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;

    const v00 = this.val(x0, y0);
    const v10 = this.val(x0 + 1, y0);
    const v01 = this.val(x0, y0 + 1);
    const v11 = this.val(x0 + 1, y0 + 1);

    const u = fade(tx);
    const v = fade(ty);

    const a = lerp(v00, v10, u);
    const b = lerp(v01, v11, u);
    return lerp(a, b, v);
  }
}

/** Fractal Brownian Motion using a 2D noise source */
export function fbm2D(
  noise: ValueNoise2D,
  x: number,
  y: number,
  params: NoiseParams,
  baseFreq: number
): number {
  const { octaves, lacunarity, gain } = params;
  let amp = 0.5;
  let freq = baseFreq;
  let sum = 0;
  let norm = 0;

  for (let o = 0; o < octaves; o++) {
    sum += noise.sample(x, y, freq) * amp;
    norm += amp;
    freq *= lacunarity;
    amp *= gain;
  }

  return norm > 0 ? sum / norm : 0;
}

/**
 * Domain-warped fBM: compute two auxiliary noises to warp coordinates before sampling.
 * `warp` is the pixel-scale intensity (e.g., 10..80 for visible swirls at 512²).
 */
export function warpedFbm2D(
  nBase: ValueNoise2D,
  nWarpX: ValueNoise2D,
  nWarpY: ValueNoise2D,
  x: number,
  y: number,
  params: NoiseParams,
  baseFreq: number,
  warp: number,
  warpFreq = baseFreq * 0.5
) {
  const wx = fbm2D(nWarpX, x, y, params, warpFreq);
  const wy = fbm2D(nWarpY, x, y, params, warpFreq);
  // Center warp around 0 by subtracting 0.5
  const dx = (wx - 0.5) * warp;
  const dy = (wy - 0.5) * warp;
  return fbm2D(nBase, x + dx, y + dy, params, baseFreq);
}

/**
 * Fill a heightfield (Float32Array length size*size) using domain-warped fBM.
 * - `params.noise` controls octaves/lacunarity/gain/warp.
 * - `baseFreq` controls overall “zoom”. Try 1/128 for 512² maps.
 * - Normalizes to [0,1] with optional gentle island mask if you want it (off by default).
 */
export function generateHeightField(
  out: Float32Array,
  size: number,
  seed: number,
  params: SimParams,
  baseFreq = 1 / 128,
  opts?: { islandMask?: boolean }
) {
  const nBase = new ValueNoise2D(seed ^ 0x9e3779b9);
  const nWarpX = new ValueNoise2D(seed ^ 0x517cc1b7);
  const nWarpY = new ValueNoise2D(seed ^ 0x85ebca6b);

  const np = params.noise;
  const warp = np.warp;

  // Generate raw values, track min/max for normalization
  let minV = Infinity, maxV = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = warpedFbm2D(nBase, nWarpX, nWarpY, x, y, np, baseFreq, warp);
      out[y * size + x] = v;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }

  const inv = maxV > minV ? 1 / (maxV - minV) : 1;

  // Normalize to [0,1] and apply optional radial island mask
  const useMask = !!opts?.islandMask;
  const cx = (size - 1) * 0.5;
  const cy = (size - 1) * 0.5;
  const maxR = Math.hypot(cx, cy);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let h = (out[i] - minV) * inv; // 0..1

      if (useMask) {
        const dx = (x - cx) / maxR;
        const dy = (y - cy) / maxR;
        const r = Math.sqrt(dx * dx + dy * dy); // 0 center → ~1 corner
        // Gentle island: drop near edges with a smoothstep
        const mask = 1 - smoothstep(0.7, 1.0, r);
        h *= mask;
      }

      out[i] = h;
    }
  }
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

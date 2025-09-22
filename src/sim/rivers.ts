import type { Fields, SimParams } from "../model/types";

/**
 * Compute river mask from a heightfield using D8 flow routing + accumulation.
 * - Routes each cell to its steepest *lower* neighbor (or nowhere if local sink/sea).
 * - Processes cells from highest → lowest to maintain a DAG-ish order.
 * - Thresholds accumulated flow to binary river mask.
 *
 * NOTE: Rivers are inherently *global* (upstream changes propagate downstream).
 * For correctness, this recomputes the whole grid. It’s O(n log n) from the sort.
 * At 512² it’s usually fine. Optimize later (tiles/queues) if needed.
 */
export function computeRivers(fields: Fields, size: number, params: SimParams) {
  const { height, rivers } = fields;
  const sea = params.climate.seaLevel;
  const n = size * size;

  // Flow accumulation buffer (float)
  // Start with 1 "unit" of rain in every land cell; 0 for ocean.
  const accum = new Float32Array(n);

  // Precompute processing order: indices sorted by height DESC
  const indices = new Uint32Array(n);
  for (let i = 0; i < n; i++) indices[i] = i;
  indices.sort((a, b) => height[b] - height[a]);

  // Helper: get steepest downhill neighbor index (or -1 if none)
  const downhill = (i: number): number => {
    const y = Math.floor(i / size), x = i - y * size;
    const z = height[i];
    let bestIdx = -1;
    let bestDrop = 0;

    // 8 neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const j = ny * size + nx;
        const zj = height[j];
        const drop = z - zj;
        if (drop > bestDrop) {
          bestDrop = drop;
          bestIdx = j;
        }
      }
    }
    // require strictly lower neighbor
    return bestDrop > 0 ? bestIdx : -1;
  };

  // Accumulate: each land cell contributes 1 + incoming, pushes downstream
  for (let k = 0; k < n; k++) {
    const i = indices[k];
    const z = height[i];
    if (z <= sea) {
      accum[i] = 0; // ocean doesn't accumulate/rout
      continue;
    }
    const base = 1; // unit rainfall; later you could modulate by moisture
    const total = accum[i] + base;
    const j = downhill(i);
    if (j >= 0) {
      accum[j] += total;
    }
    accum[i] = total;
  }

  // Normalize accumulation so thresholds are scale-invariant
  let maxA = 0;
  for (let i = 0; i < n; i++) if (accum[i] > maxA) maxA = accum[i];
  const invMax = maxA > 0 ? 1 / maxA : 1;

  const thr = params.riverThreshold; // expect ~0.01..0.05
  for (let i = 0; i < n; i++) {
    const z = height[i];
    if (z <= sea) {
      rivers[i] = 0;
      continue;
    }
    const a = accum[i] * invMax;
    rivers[i] = a >= thr ? 1 : 0;
  }
}

/**
 * Optional polish: thicken/anti-alias the river mask with a cheap dilation.
 * Run after computeRivers() if you want slightly wider lines visually.
 */
export function dilateRivers(rivers: Uint8Array, size: number, passes = 1) {
  const out = new Uint8Array(rivers);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (rivers[i]) { out[i] = 1; continue; }
        // 4-neighborhood (use 8-neighborhood for thicker)
        if (
          (x > 0 && rivers[i - 1]) ||
          (x + 1 < size && rivers[i + 1]) ||
          (y > 0 && rivers[i - size]) ||
          (y + 1 < size && rivers[i + size])
        ) {
          out[i] = 1;
        }
      }
    }
    rivers.set(out);
  }
}

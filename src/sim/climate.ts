// /src/sim/climate.ts
import type { SimParams, Fields } from "../model/types";
import type { DirtyRect } from "./brush";
import { Biome } from "../model/constants";

// Helpers
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const rectAll = (size: number): DirtyRect => ({ x0: 0, y0: 0, x1: size - 1, y1: size - 1 });

/**
 * Temperature model:
 * - Colder with elevation (tempLapse)
 * - Colder toward poles (top/bottom): simple latitudinal gradient
 */
export function computeTemperature(
  height: Float32Array,
  size: number,
  params: SimParams,
  out: Float32Array,
  rect?: DirtyRect
) {
  const { tempLapse } = params.climate;
  const r = rect ?? rectAll(size);

  for (let y = r.y0; y <= r.y1; y++) {
    const lat = y / (size - 1);                 // 0 at top, 1 at bottom
    const pole = Math.abs(lat - 0.5) * 2;       // 0 at equator, 1 at poles
    for (let x = r.x0; x <= r.x1; x++) {
      const i = y * size + x;
      const h = height[i];                      // 0..1
      // Base warmth higher near equator, lower at poles; drop with elevation
      const t = clamp01(1 - tempLapse * h - 0.6 * pole);
      out[i] = t;
    }
  }
}

/**
 * Moisture model:
 * - More moisture at low elevations (inversely related to height)
 * - Optional crude wind rain-shadow from west→east using height slope
 * - Global shift from params.climate.moistureShift
 */
export function computeMoisture(
  height: Float32Array,
  size: number,
  params: SimParams,
  out: Float32Array,
  rect?: DirtyRect
) {
  const { moistureShift } = params.climate;
  const r = rect ?? rectAll(size);

  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) {
      const i = y * size + x;
      const h = height[i];
      // base: wetter in valleys/plains
      let m = clamp01(1 - h + moistureShift);

      // crude rain-shadow: if terrain rises from west→east, add; if falls, subtract
      const left = x > 0 ? height[y * size + (x - 1)] : h;
      const right = x < size - 1 ? height[y * size + (x + 1)] : h;
      const slope = right - left;         // >0 rising eastward
      m = clamp01(m + 0.15 * Math.max(0, slope) - 0.10 * Math.max(0, -slope));

      out[i] = m;
    }
  }
}

/**
 * Classify biomes from (sea level, temp, moisture, elevation).
 * Thresholds are intentionally simple and easy to tweak.
 */
export function classifyBiomes(
  height: Float32Array,
  temperature: Float32Array,
  moisture: Float32Array,
  size: number,
  params: SimParams,
  out: Uint8Array,
  rect?: DirtyRect
) {
  const sea = params.climate.seaLevel;
  const r = rect ?? rectAll(size);

  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) {
      const i = y * size + x;
      const h = height[i];
      const t = temperature[i];
      const m = moisture[i];

      // Water & coasts
      if (h < sea) {
        out[i] = Biome.Ocean;
        continue;
      }
      if (h < sea + 0.02) {
        out[i] = Biome.Beach;
        continue;
      }

      // High mountains & snowcaps
      if (h > 0.88 && t < 0.45) {
        out[i] = Biome.Snow;
        continue;
      }
      if (h > 0.84) {
        out[i] = Biome.Mountain;
        continue;
      }

      // Temperature & moisture bands
      if (t < 0.33) {
        // cold
        out[i] = m < 0.35 ? Biome.Tundra : Biome.BorealForest;
      } else if (t < 0.66) {
        // temperate
        if (m < 0.30) out[i] = Biome.Shrubland;
        else if (m < 0.55) out[i] = Biome.Grassland;
        else out[i] = Biome.TemperateForest;
      } else {
        // warm/hot
        if (m < 0.28) out[i] = Biome.Desert;
        else if (m < 0.55) out[i] = Biome.Savanna;
        else out[i] = Biome.Rainforest;
      }
    }
  }
}

/**
 * Convenience: recompute all derived layers after height changes.
 * If `rect` provided, only recompute that area (fast brushes).
 */
export function recomputeDerived(
  fields: Fields,
  size: number,
  params: SimParams,
  rect?: DirtyRect
) {
  computeTemperature(fields.height, size, params, fields.temperature, rect);
  computeMoisture(fields.height, size, params, fields.moisture, rect);
  classifyBiomes(fields.height, fields.temperature, fields.moisture, size, params, fields.biomes, rect);
}

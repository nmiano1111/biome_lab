// /src/pixi/textures.ts (Pixi v8)
import { Texture, BufferImageSource } from "pixi.js";
import type { Fields } from "../model/types";
import {blendColors, detailNoise} from "./colors";

function blendColors(c1: number, c2: number, t: number) {
  const r = ((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t;
  const g = ((c1 >>  8) & 255) * (1 - t) + ((c2 >>  8) & 255) * t;
  const b = ( c1        & 255) * (1 - t) + ( c2        & 255) * t;
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
}

// quick hash-noise for subtle texture
function detailNoise(x: number, y: number, seed: number) {
  let n = (x * 374761393) ^ (y * 668265263) ^ (seed * 1274126177);
  n ^= n >>> 13; n = Math.imul(n, 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 0xffffffff;
}

// median of a downsampled copy (avoid sorting 262k values)
function medianHeight(H: Float32Array): number {
  const N = H.length;
  const sample = 32768; // ~32k for speed/quality
  if (N <= sample) {
    const a = Array.from(H);
    a.sort((x, y) => x - y);
    return a[(a.length >> 1)];
  }
  const step = Math.floor(N / sample);
  const a = new Array<number>(sample);
  for (let i = 0, idx = 0; i < sample; i++, idx += step) a[i] = H[idx];
  a.sort((x, y) => x - y);
  return a[a.length >> 1];
}


/** Build a Pixi Texture from an RGBA Uint8Array buffer (v8 API). */
function textureFromRGBA(rgba: Uint8Array, size: number): Texture {
  const source = new BufferImageSource({
    resource: rgba,
    width: size,
    height: size,
    // If TS complains about format typing, remove this line; it’s a hint.
    format: "rgba8unorm" as any,
  });
  return new Texture({ source });
}

/**
 * Convert a Float32 heightfield (0..1) into an 8-bit grayscale texture.
 * For large maps, consider pre-normalizing in the worker.
 */
export function textureFromHeight(height: Float32Array, size: number): Texture {
  const buf = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, (height[i] * 255) | 0));
    const j = i * 4;
    buf[j] = v; buf[j + 1] = v; buf[j + 2] = v; buf[j + 3] = 255;
  }
  return textureFromRGBA(buf, size);
}

/**
 * Convert a biome index map into a colorized RGBA texture.
 * `palette` is an array of [r,g,b] triplets indexed by biome value.
 */
export function textureFromBiomes(
  biomes: Uint8Array,
  size: number,
  palette: [number, number, number][]
): Texture {
  const buf = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const idx = biomes[i] ?? 0;
    const [r, g, b] = palette[idx] ?? [128, 128, 128];
    const j = i * 4;
    buf[j] = r; buf[j + 1] = g; buf[j + 2] = b; buf[j + 3] = 255;
  }
  return textureFromRGBA(buf, size);
}

/** Convert a river mask into a semi-transparent blue overlay texture. */
export function textureFromRivers(rivers: Uint8Array, size: number): Texture {
  const buf = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const on = rivers[i] ? 1 : 0;
    const j = i * 4;
    buf[j] = 0; buf[j + 1] = 100; buf[j + 2] = 255; buf[j + 3] = on ? 200 : 0;
  }
  return textureFromRGBA(buf, size);
}

/** Convenience: build all three textures from Fields. */
export function texturesFromFields(
  fields: Fields,
  size: number,
  palette: [number, number, number][]
) {
  return {
    heightTex: textureFromHeight(fields.height, size),
    biomeTex: textureFromBiomes(fields.biomes, size, palette),
    riversTex: textureFromRivers(fields.rivers, size),
  };
}

export function textureFromTerrain(
  height: Float32Array,
  size: number,
  seed: number,
  opts?: {
    seaLevel?: number;     // if omitted, we auto-derive
    contour?: boolean;
    textureAmount?: number; // 0..0.2
    shadeStrength?: number; // default 5.0
    normalize?: boolean;    // optional
  }
): Texture {
  const doContours   = opts?.contour ?? true;
  const textureAmt   = opts?.textureAmount ?? 0.08;
  const shadeK       = opts?.shadeStrength ?? 5.0;
  const normalize    = opts?.normalize ?? false;

  // optional normalization to [0,1]
  let H = height;
  if (normalize) {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < height.length; i++) {
      const v = height[i]; if (v < min) min = v; if (v > max) max = v;
    }
    const span = (max - min) || 1;
    const tmp = new Float32Array(height.length);
    for (let i = 0; i < height.length; i++) tmp[i] = (height[i] - min) / span;
    H = tmp;
  }

  const seaLevel = opts?.seaLevel ?? medianHeight(H); // <- auto sea level

  // palette
  const WATER_DEEP = 0x0a1b2e;
  const WATER_SHAL = 0x1e4f7a;
  const SAND_LO    = 0xe7d9a7;
  const GRASS_LO   = 0x5f8b4a;
  const GRASS_HI   = 0x93b46b;
  const ROCK       = 0x7f7f7f;
  const SNOW       = 0xf2f6f8;

  const buf = new Uint8Array(size * size * 4);

  const hAt = (xx: number, yy: number) => {
    const x = xx < 0 ? 0 : xx >= size ? size - 1 : xx;
    const y = yy < 0 ? 0 : yy >= size ? size - 1 : yy;
    return H[y * size + x];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const e = H[i];

      // base color
      let base: number;
      if (e < seaLevel) {
        const t = Math.min(1, (seaLevel - e) / Math.max(1e-6, seaLevel));
        base = blendColors(WATER_SHAL, WATER_DEEP, t);
      } else {
        const t = Math.min(1, (e - seaLevel) / Math.max(1e-6, 1 - seaLevel));
        if (t < 0.10)      base = blendColors(SAND_LO,  GRASS_LO, t / 0.10);
        else if (t < 0.60) base = blendColors(GRASS_LO, GRASS_HI, (t - 0.10) / 0.50);
        else if (t < 0.85) base = blendColors(ROCK,     GRASS_HI, (0.85 - t) / 0.25);
        else               base = blendColors(ROCK,     SNOW,      (t - 0.85) / 0.15);
      }

      // hill shading
      const dx = hAt(x + 1, y) - hAt(x - 1, y);
      const dy = hAt(x, y + 1) - hAt(x, y - 1);
      const slope = Math.sqrt(dx * dx + dy * dy);
      const light = Math.max(0.35, 1 - slope * shadeK);
      let shaded = blendColors(base, 0x000000, 1 - light);

      // subtle texture
      const d = detailNoise(x, y, seed);
      shaded = blendColors(shaded, 0xffffff, d * textureAmt);

      // contours only above sea
      if (doContours && e >= seaLevel) {
        const step = 0.05;
        const band = Math.abs((((e - seaLevel) / Math.max(1e-6, 1 - seaLevel)) % step) - step / 2) / (step / 2);
        if (band < 0.06) shaded = blendColors(shaded, 0x000000, 0.12);
      }

      // ---- WRITE PIXELS (BGRA fixes “blue looks brown”)
      const j = i * 4;
      // BGRA:
      buf[j    ] = (shaded >> 16) & 255; // B
      buf[j + 1] = (shaded >>  8) & 255; // G
      buf[j + 2] = (shaded      ) & 255; // R
      buf[j + 3] = 255;                  // A

      // If your water looks correct already, you can switch to RGBA:
      // buf[j] = (shaded) & 255; buf[j+1] = (shaded>>8) & 255; buf[j+2] = (shaded>>16) & 255; buf[j+3] = 255;
    }
  }

  return textureFromRGBA(buf, size);
}


export function terrainTextureFromFields(
  fields: Fields,
  size: number,
  seed: number,
  seaLevel?: number // optional override
) {
  return {
    terrainTex: textureFromTerrain(fields.height, size, seed, {
      seaLevel,          // if undefined we auto-derive
      contour: true,
      textureAmount: 0.08,
      shadeStrength: 5.0,
      // normalize: true, // enable if coastlines look off due to warped ranges
    }),
    riversTex: textureFromRivers(fields.rivers, size),
  };
}

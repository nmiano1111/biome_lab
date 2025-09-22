// /src/pixi/textures.ts (Pixi v8)
import { Texture, BufferImageSource } from "pixi.js";
import type { Fields } from "../model/types";

/** Build a Pixi Texture from an RGBA Uint8Array buffer (v8 API). */
function textureFromRGBA(rgba: Uint8Array, size: number): Texture {
  const source = new BufferImageSource({
    resource: rgba,   // typed array with RGBA pixels
    width: size,
    height: size,
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

export function textureFromNormals(normals: Uint8Array, size: number): Texture {
  const source = new BufferImageSource({ resource: normals, width: size, height: size, format: "rgb" as any });
  // If TS complains about format typing, just omit it; v8 will infer RGB for length/3.
  return new Texture({ source });
}

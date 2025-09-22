// /src/pixi/renderer.ts (Pixi v8)
import { Texture, BufferImageSource } from "pixi.js";
import type { Fields } from "../model/types";
import { BIOME_PALETTE } from "../model/constants";

/* --- RGBA builders --- */
function heightToRGBA(height: Float32Array, size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, (height[i] * 255) | 0));
    const j = i * 4;
    out[j] = v; out[j + 1] = v; out[j + 2] = v; out[j + 3] = 255;
  }
  return out;
}
function biomesToRGBA(biomes: Uint8Array, size: number, pal: [number, number, number][]): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = pal[biomes[i]] ?? [128, 128, 128];
    const j = i * 4;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
  }
  return out;
}
function riversToRGBA(rivers: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const on = rivers[i] ? 1 : 0;
    const j = i * 4;
    out[j] = 0; out[j + 1] = 100; out[j + 2] = 255; out[j + 3] = on ? 200 : 0;
  }
  return out;
}

/* --- v8: create Texture from a typed-array buffer --- */
function textureFromRGBA(rgba: Uint8Array, size: number): Texture {
  const src = new BufferImageSource({
    resource: rgba,
    width: size,
    height: size,
  });
  return new Texture({ source: src });
}

/* --- Simple path: build NEW textures each time --- */
export function texturesFromFields(
  fields: Fields,
  size: number,
  palette: [number, number, number][] = BIOME_PALETTE
) {
  const heightTex = textureFromRGBA(heightToRGBA(fields.height, size), size);
  const biomeTex  = textureFromRGBA(biomesToRGBA(fields.biomes, size, palette), size);
  const riversTex = textureFromRGBA(riversToRGBA(fields.rivers, size), size);
  return { heightTex, biomeTex, riversTex };
}

/* --- Advanced: in-place updates on existing textures --- */
function updateBufferTexture(tex: Texture, rgba: Uint8Array, size: number): boolean {
  const src = tex.source; // TextureSource
  // Ensure it's a BufferImageSource (has resource: TypedArray and update())
  // Typings: runtime has update/resource; TS needs a nudge:
  const buf = src as unknown as { resource: Uint8Array; width: number; height: number; update: () => void };
  if (buf.width !== size || buf.height !== size || buf.resource.length !== rgba.length) return false;
  buf.resource.set(rgba);
  buf.update();
  return true;
}

/** Try to update in place; if sizes/types don’t match, recreate. */
export function updateFromFields(
  fields: Fields,
  layers: { heightTex: Texture; biomeTex: Texture; riversTex: Texture; },
  size: number,
  palette: [number, number, number][] = BIOME_PALETTE
) {
  const h = heightToRGBA(fields.height, size);
  const b = biomesToRGBA(fields.biomes, size, palette);
  const r = riversToRGBA(fields.rivers, size);

  if (!updateBufferTexture(layers.heightTex, h, size)) layers.heightTex = textureFromRGBA(h, size);
  if (!updateBufferTexture(layers.biomeTex,  b, size)) layers.biomeTex  = textureFromRGBA(b, size);
  if (!updateBufferTexture(layers.riversTex, r, size)) layers.riversTex = textureFromRGBA(r, size);
}

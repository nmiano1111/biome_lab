// /src/pixi/colors.ts
export function blendColors(c1: number, c2: number, t: number) {
  const r = ((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t;
  const g = ((c1 >>  8) & 255) * (1 - t) + ((c2 >>  8) & 255) * t;
  const b = ( c1        & 255) * (1 - t) + ( c2        & 255) * t;
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
}

// quick hash-noise (fast, no deps) for tiny texture variation
export function detailNoise(x: number, y: number, seed: number) {
  let n = (x * 374761393) ^ (y * 668265263) ^ (seed * 1274126177);
  n = (n ^ (n >>> 13)) * 1274126177;
  n = (n ^ (n >>> 16));
  // map to [0,1)
  return (n >>> 0) / 0xffffffff;
}
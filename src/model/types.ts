export type Seed = number;

export type NoiseParams = {
  octaves: number; lacunarity: number; gain: number; warp: number;
};

export type ClimateParams = {
  seaLevel: number; tempLapse: number; moistureShift: number;
};

export type SimParams = {
  size: number;    // e.g., 512, 1024 (power of two helps tiling)
  noise: NoiseParams;
  climate: ClimateParams;
  riverThreshold: number; // flow needed to “paint” river
};

export type BrushKind = 'raise'|'lower'|'rain'|'smooth';
export type Brush = { kind: BrushKind; radius: number; strength: number };

export type Fields = {
  height: Float32Array;      // size*size
  temperature: Float32Array; // derived
  moisture: Float32Array;    // derived
  rivers: Uint8Array;        // mask 0/1
  biomes: Uint8Array;        // enum index
};

export type Snapshot = { seed: Seed; params: SimParams; label?: string };
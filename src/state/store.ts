// /src/state/store.ts
import { create } from "zustand";
import type { SimParams, Brush, Snapshot } from "../model/types";

export type UIState = {
  seed: number;
  params: SimParams;
  brush: Brush;
  snapshots: Snapshot[];

  // actions
  setParams: (p: Partial<SimParams>) => void;
  setBrush: (b: Partial<Brush>) => void;
  addSnapshot: (s: Snapshot) => void;
  setSeed: (seed: number) => void;
};

export const useUIStore = create<UIState>((set) => ({
  seed: Date.now(),
  params: {
    size: 512,
    noise: { octaves: 4, lacunarity: 2, gain: 0.5, warp: 0.1 },
    climate: { seaLevel: 0.4, tempLapse: 0.5, moistureShift: 0 },
    riverThreshold: 0.01,
  },
  brush: { kind: "raise", radius: 5, strength: 0.1 },
  snapshots: [],

  setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
  setBrush: (b) => set((s) => ({ brush: { ...s.brush, ...b } })),
  addSnapshot: (s) => set((s0) => ({ snapshots: [...s0.snapshots, s] })),
  setSeed: (seed) => set(() => ({ seed })),
}));

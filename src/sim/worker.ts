// /src/sim/worker.ts
// Simulation worker entrypoint (runs in a Web Worker).
// No DOM or Pixi imports here—pure compute + messaging.
/// <reference lib="webworker" />

import type { WorkerIn, WorkerOut } from "./protocol";
import type { Fields, SimParams } from "../model/types";
import type { DirtyRect } from "./brush";
import { applyBrush } from "./brush";
import { generateHeightField } from "./noise";
import { recomputeDerived } from "./climate";
import { computeRivers /*, dilateRivers */ } from "./rivers";

// If you prefer stricter typing of 'self' as a DedicatedWorkerGlobalScope:
const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

// ---------- State held inside the worker ----------
let size = 512;
let seed = 1;
let params: SimParams;
let fields: Fields;

// Tune this as needed
const DEFAULT_BASE_FREQ = 1 / 128;
const USE_ISLAND_MASK = false;

// ---------- Helpers ----------
function allocateFields(n: number): Fields {
  return {
    height: new Float32Array(n * n),
    temperature: new Float32Array(n * n),
    moisture: new Float32Array(n * n),
    rivers: new Uint8Array(n * n),
    biomes: new Uint8Array(n * n),
  };
}

function ensureSize(newSize: number) {
  if (!fields || size !== newSize) {
    size = newSize;
    fields = allocateFields(size);
  }
}

function postProgress(phase: string, pct: number) {
  const msg: WorkerOut = { t: "progress", phase, pct };
  ctx.postMessage(msg);
}

function postResult() {
  const msg: WorkerOut = { t: "result", fields };
  ctx.postMessage(msg); // <-- remove the transfer list
}

function fullRecompute() {
  postProgress("height", 0.0);
  generateHeightField(
    fields.height,
    size,
    seed,
    params,
    DEFAULT_BASE_FREQ,
    { islandMask: USE_ISLAND_MASK }
  );
  postProgress("height", 1.0);

  postProgress("climate", 0.0);
  recomputeDerived(fields, size, params);
  postProgress("climate", 1.0);

  postProgress("rivers", 0.0);
  computeRivers(fields, size, params);
  // Optional visual thickening:
  // dilateRivers(fields.rivers, size, 1);
  postProgress("rivers", 1.0);
}

function partialRecompute(dirty: DirtyRect) {
  // Recompute temperature/moisture/biomes only in dirty area for snappy brushes
  recomputeDerived(fields, size, params, dirty);

  // Rivers are global (upstream effects), so do a full recompute for correctness.
  // At 512² this is fine; you can optimize later with tiling/queues.
  computeRivers(fields, size, params);
}

// ---------- Message handling ----------
ctx.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;

  switch (msg.t) {
    case "init": {
      params = msg.params;
      seed = msg.seed;
      ensureSize(params.size);
      fullRecompute();
      postResult();
      break;
    }

    case "recompute": {
      params = msg.params;
      ensureSize(params.size);
      fullRecompute();
      postResult();
      break;
    }

    case "brush": {
      // Mutate height/moisture locally, then recompute derived + rivers
      const dirty = applyBrush(
        fields.height,
        fields.moisture,
        size,
        msg.x,
        msg.y,
        msg.brush
      );
      partialRecompute(dirty);
      postResult();
      break;
    }
  }
};

// Make this a module (avoids TS/rollup treating file as script)
export {};

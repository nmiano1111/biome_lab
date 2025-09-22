// /src/sim/workerBridge.ts
// Main-thread glue: wires the simulation Web Worker to the Pixi stage.
// No simulation logic here—just messaging + texture updates.

import type { Stage } from "../pixi/stage";
import {terrainTextureFromFields, texturesFromFields} from "../pixi/textures";
import { BIOME_PALETTE } from "../model/constants";
import type { SimParams, Brush } from "../model/types";
import type { WorkerIn, WorkerOut } from "./protocol";

type BridgeOpts = {
  onProgress?: (phase: string, pct: number) => void;
  // If true, only apply the latest 'result' per animation frame
  rafCoalesce?: boolean;
};

export type WorkerBridge = {
  worker: Worker;
  init: (seed: number, params: SimParams) => void;
  recompute: (params: SimParams) => void;
  brush: (x: number, y: number, brush: Brush) => void;
  dispose: () => void;
};

/**
 * Create a bridge between the sim worker and the Pixi stage.
 * @param stage Pixi Stage (height/biome/rivers sprites)
 * @param initialSize Simulation grid size (must match params.size you send)
 * @param opts Optional callbacks & behavior
 */
export function createWorkerBridge(
  stage: Stage,
  initialSize: number,
  opts: BridgeOpts = {}
): WorkerBridge {
  const { onProgress, rafCoalesce = true } = opts;

  // Create the worker (Vite/Rollup-compatible URL)
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  // Keep current sim size (texturesFromFields needs it)
  let simSize = initialSize;
  let currentSeed = 1;
  let currentParams: SimParams | null = null;

  // Optional coalescing: if we get many 'result' messages quickly,
  // apply only the latest one on the next animation frame.
  let pendingResult: WorkerOut | null = null;
  let rafId: number | null = null;

  function applyResult(msg: Extract<WorkerOut, { t: "result" }>) {
    const { terrainTex, riversTex } = terrainTextureFromFields(
      msg.fields,
      simSize,
      currentSeed,
      /* seaLevel */ undefined // let textures.ts auto-derive median
    );
    stage.setTerrainTexture(terrainTex);
    stage.setRiversTexture(riversTex);
  }

  function scheduleApply() {
    if (!rafCoalesce) {
      const latest = pendingResult as Extract<WorkerOut, { t: "result" }>;
      pendingResult = null;
      applyResult(latest);
      return;
    }
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (pendingResult && pendingResult.t === "result") {
        const latest = pendingResult;
        pendingResult = null;
        applyResult(latest);
      }
    });
  }

  worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
    const msg = ev.data;
    switch (msg.t) {
      case "progress": {
        onProgress?.(msg.phase, msg.pct);
        break;
      }
      case "result": {
        // Coalesce to avoid spamming texture uploads
        pendingResult = msg;
        scheduleApply();
        break;
      }
    }
  };

  // --- Outgoing helpers (main -> worker) ---
  function post(msg: WorkerIn) {
    worker.postMessage(msg);
  }

  const api: WorkerBridge = {
    worker,
    /*
    init(seed: number, params: SimParams) {
      simSize = params.size;
      stage.setWorldSize(simSize);
      post({ t: "init", seed, params });
    },

     */
    init(seed: number, params: SimParams) {
      currentSeed = seed;
      currentParams = params;           // <-- add
      simSize = params.size;
      stage.setWorldSize(simSize);
      post({ t: "init", seed, params });
    },
    recompute(params: SimParams) {
      currentParams = params;           // <-- add
      simSize = params.size;
      stage.setWorldSize(simSize);
      post({ t: "recompute", params });
    },
    brush(x: number, y: number, brush: Brush) {
      post({ t: "brush", x, y, brush });
    },
    dispose() {
      if (rafId != null) cancelAnimationFrame(rafId);
      pendingResult = null;
      worker.terminate();
    },
  };

  return api;
}

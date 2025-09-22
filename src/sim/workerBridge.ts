// /src/sim/workerBridge.ts

import type { Stage } from "../pixi/stage";
import { terrainTextureFromFields } from "../pixi/textures";
import type { SimParams, Brush } from "../model/types";
import type { WorkerIn, WorkerOut } from "./protocol";

type BridgeOpts = {
  onProgress?: (phase: string, pct: number) => void;
  rafCoalesce?: boolean;
};

export type WorkerBridge = {
  worker: Worker;
  init: (seed: number, params: SimParams) => void;
  recompute: (params: SimParams) => void;
  brush: (x: number, y: number, brush: Brush) => void;
  setSeaLevel: (level: number) => void;   // <-- add
  dispose: () => void;
};

export function createWorkerBridge(
  stage: Stage,
  initialSize: number,
  opts: BridgeOpts = {}
): WorkerBridge {
  const { onProgress, rafCoalesce = true } = opts;

  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

  let simSize = initialSize;
  let currentSeed = 1;
  let currentParams: SimParams | null = null;

  let currentSeaLevel = 0.45;                // <-- add
  let lastFields: Extract<WorkerOut, { t: "result" }>["fields"] | null = null; // <-- add

  let pendingResult: WorkerOut | null = null;
  let rafId: number | null = null;

  function paintFrom(fields: NonNullable<typeof lastFields>) {
    const { terrainTex, riversTex } = terrainTextureFromFields(
      fields,
      simSize,
      currentSeed,
      currentSeaLevel            // <-- use slider value
    );
    stage.setTerrainTexture(terrainTex);
    stage.setRiversTexture(riversTex);
  }

  function applyResult(msg: Extract<WorkerOut, { t: "result" }>) {
    lastFields = msg.fields;     // <-- cache latest fields
    paintFrom(lastFields);
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
        const latest = pendingResult as Extract<WorkerOut, { t: "result" }>;
        pendingResult = null;
        applyResult(latest);
      }
    });
  }

  worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
    const msg = ev.data;
    switch (msg.t) {
      case "progress":
        onProgress?.(msg.phase, msg.pct);
        break;
      case "result":
        pendingResult = msg;
        scheduleApply();
        break;
    }
  };

  function post(msg: WorkerIn) {
    worker.postMessage(msg);
  }

  const api: WorkerBridge = {
    worker,
    init(seed: number, params: SimParams) {
      currentSeed = seed;
      currentParams = params;
      simSize = params.size;
      stage.setWorldSize(simSize);
      post({ t: "init", seed, params });
    },
    recompute(params: SimParams) {
      currentParams = params;
      simSize = params.size;
      stage.setWorldSize(simSize);
      post({ t: "recompute", params });
    },
    brush(x: number, y: number, brush: Brush) {
      // post({ t: "brush", x, y, brush });
    },
    setSeaLevel(level: number) {           // <-- new API
      currentSeaLevel = level;
      if (lastFields) paintFrom(lastFields); // re-shade only, no worker round-trip
    },
    dispose() {
      if (rafId != null) cancelAnimationFrame(rafId);
      pendingResult = null;
      worker.terminate();
    },
  };

  return api;
}

// /src/pixi/app.ts
import { Application } from "pixi.js";
import { createStage, type Stage } from "./stage";

/**
 * Create and initialize a PixiJS Application bound to a canvas.
 * Returns both the app and the stage wrapper (with layers + helpers).
 *
 * @param canvas HTMLCanvasElement to render into
 * @param worldSize Initial world size (usually matches simulation grid size, e.g. 512)
 */
export const createPixiApp = async (
  canvas: HTMLCanvasElement,
  worldSize: number = 512
): Promise<{ app: Application; stage: Stage; destroy: () => void }> => {
  const app = new Application();

  // Init with high-performance settings
  await app.init({
    canvas,
    backgroundAlpha: 1,
    antialias: false,
    powerPreference: "high-performance",
    resizeTo: window, // auto-resize renderer to window size
  });

  // Our stage wrapper (handles layers, scaling, etc.)
  const stage = createStage(app, worldSize);

  // Hook resize: Pixi auto-resizes the renderer, we just need to refit our stage
  const onResize = () => stage.resize();
  window.addEventListener("resize", onResize);

  // Clean-up function
  const destroy = () => {
    window.removeEventListener("resize", onResize);
    stage.destroy();
    app.destroy(true, { children: true });
  };

  return { app, stage, destroy };
}

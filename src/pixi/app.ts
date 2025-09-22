// /src/pixi/app.ts
import { Application } from "pixi.js";
import { createStage } from "./stage";
import { attachCameraControls } from "./cameraControl";

export const createPixiApp = async (
  canvas: HTMLCanvasElement,
  worldSize = 512
) => {
  const app = new Application();
  await app.init({
    canvas,
    backgroundAlpha: 1,
    antialias: false,
    powerPreference: "high-performance",
    resizeTo: window,
  });

  const stage = createStage(app, worldSize);

  // Make the rendered world larger in pixels (more to pan)
  stage.setWorldPixelScale(4); // try 2..6; 4× turns 512 → 2048 px world

  // Start zoomed-in relative to fit (Stage will clamp min zoom so zooming out still fills)
  requestAnimationFrame(() => {
    stage.setZoom(2.0);
  });

  // Let Stage handle min/max clamping; keep controls “dumb”
  const controls = attachCameraControls(stage, canvas, {
    zoomStep: 1.12,
    // omit minZoom here or set it >= Stage's minimum-overfit (if you set one)
    // minZoom: 1.0,
    maxZoom: 6,
  });

  const onResize = () => stage.resize();
  window.addEventListener("resize", onResize);

  const destroy = () => {
    window.removeEventListener("resize", onResize);
    controls.destroy();
    stage.destroy();
    app.destroy(true, { children: true });
  };

  return { app, stage, destroy };
};

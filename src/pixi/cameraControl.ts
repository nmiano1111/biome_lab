// cameraControls.ts
import type { Stage } from "../pixi/stage";

type CameraOpts = {
  zoomStep?: number;     // multiplicative wheel step (default 1.1)
  minZoom?: number;      // optional clamp
  maxZoom?: number;      // optional clamp
  invertScroll?: boolean;// if you prefer natural/inverted wheel
};

export function attachCameraControls(
  stage: Stage,
  target: HTMLElement,    // your canvas element (PIXI app.view), or wrapper div
  opts: CameraOpts = {}
) {
  const zoomStep = opts.zoomStep ?? 1.1;
  const minZ = opts.minZoom ?? 0.25;
  const maxZ = opts.maxZoom ?? 8;

  let dragging = false;
  let lastX = 0, lastY = 0;

  // --- Panning (pointer drag)
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    target.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    stage.panBy(dx, dy);        // uses your Stage method
  };

  const onUp = () => { dragging = false; };

  // --- Zooming (wheel at cursor)
  const onWheel = (e: WheelEvent) => {
    e.preventDefault(); // keep page from scrolling
    // normalize delta: positive -> zoom out
    const dir = (opts.invertScroll ? -e.deltaY : e.deltaY) > 0 ? (1 / zoomStep) : zoomStep;

    // optional clamping: read current zoom from Stage if you expose it;
    // if not, you can clamp inside Stage.setZoom instead.
    // We’ll call zoomAt, which should handle clamping internally if you add it there.
    stage.zoomAt(e.clientX, e.clientY, dir);
  };

  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
  target.addEventListener("pointerleave", onUp);
  target.addEventListener("wheel", onWheel, { passive: false });

  return {
    destroy() {
      target.removeEventListener("pointerdown", onDown);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointerleave", onUp);
      target.removeEventListener("wheel", onWheel as any);
    }
  };
}

import type { Brush } from "../model/types";

export const attachBrushHandlers = (
  canvas: HTMLCanvasElement,
  sendBrush: (x: number, y: number, brush: Brush) => void,
  getBrush: () => Brush,
  size: number
) => {
  let painting = false;

  const evtToWorld = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * size);
    const y = Math.floor(((e.clientY - r.top) / r.height) * size);
    return { x, y };
  }

  canvas.addEventListener("pointerdown", (e) => {
    painting = true;
    const p = evtToWorld(e);
    sendBrush(p.x, p.y, getBrush());
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!painting) return;
    const p = evtToWorld(e);
    sendBrush(p.x, p.y, getBrush());
  });

  window.addEventListener("pointerup", () => { painting = false; });
}

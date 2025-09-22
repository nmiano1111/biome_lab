// /src/PixiCanvas.tsx
import { useEffect, useMemo, useRef } from "react";
import { createPixiApp } from "./pixi/app";
import { createWorkerBridge, type WorkerBridge } from "./sim/workerBridge";
import { attachBrushHandlers } from "./pixi/interactions";
import { useUIStore } from "./state/store";
import type { Brush, SimParams } from "./model/types";

type Props = {
  className?: string;
  onProgress?: (phase: string, pct: number) => void;
};

export default function PixiCanvas({ className, onProgress }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bridgeRef = useRef<WorkerBridge | null>(null);
  const destroyRef = useRef<() => void>(() => {});

  const seed = useUIStore((s) => s.seed);
  const params = useUIStore((s) => s.params);
  const brush = useUIStore((s) => s.brush);

  const brushGetter = useMemo(() => {
    return () => (useUIStore.getState().brush as Brush);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    (async () => {
      const { stage, destroy } = await createPixiApp(canvas, params.size);
      destroyRef.current = () => destroy();

      // zoom (wheel) + pan (RMB drag) handlers
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        stage.zoomAt(e.clientX, e.clientY, factor);
      };
      canvas.addEventListener("wheel", onWheel, { passive: false });

      let panning = false;
      let lastX = 0, lastY = 0;

      const onPointerDown = (e: PointerEvent) => {
        if (e.button === 2) { // right mouse
          panning = true;
          lastX = e.clientX; lastY = e.clientY;
        }
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!panning) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        stage.panBy(dx, dy);
      };
      const onPointerUp = () => { panning = false; };
      const onContextMenu = (e: MouseEvent) => e.preventDefault();

      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("contextmenu", onContextMenu);

      // extend existing destroy to also remove listeners
      const prevDestroy = destroyRef.current;
      destroyRef.current = () => {
        canvas.removeEventListener("wheel", onWheel as any);
        canvas.removeEventListener("pointerdown", onPointerDown as any);
        window.removeEventListener("pointermove", onPointerMove as any);
        window.removeEventListener("pointerup", onPointerUp as any);
        canvas.removeEventListener("contextmenu", onContextMenu as any);
        prevDestroy?.();
      };
      // Create the sim bridge and initialize
      const bridge = createWorkerBridge(stage, params.size, {
        onProgress: (phase, pct) => onProgress?.(phase, pct),
        rafCoalesce: true,
      });
      bridgeRef.current = bridge;

      // Kick off the simulation with current seed/params
      bridge.init(seed, params);

      // Brush interactions
      attachBrushHandlers(
        canvas,
        (x, y, b) => bridge.brush(x, y, b),
        brushGetter,
        params.size
      );
    })();

    return () => {
      if (disposed) return;
      disposed = true;
      try { bridgeRef.current?.dispose(); } catch {}
      try { destroyRef.current?.(); } catch {}
      bridgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paramsRef = useRef<SimParams | null>(null);
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;

    const prev = paramsRef.current;
    paramsRef.current = params;

    if (!prev || prev.size !== params.size) {
      bridge.init(seed, params);
      return;
    }
    bridge.recompute(params);
  }, [params, seed]);

  useEffect(() => {}, [brush]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}

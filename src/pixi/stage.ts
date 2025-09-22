// /src/pixi/stage.ts (Pixi v8)
import { Application, Container, Sprite, Texture, SCALE_MODES } from "pixi.js";

export type FitMode = "cover" | "contain";

export type Stage = {
  root: Container;                       // world container (scaled & positioned)
  setWorldSize: (n: number) => void;
  setFitMode: (m: FitMode) => void;
  setHeightTexture: (t: Texture) => void;
  setBiomeTexture: (t: Texture) => void;
  setRiversTexture: (t: Texture) => void;
  setTerrainTexture: (t: Texture) => void;
  resize: () => void;

  // Camera / interaction:
  setZoom: (z: number) => void;          // absolute zoom (relative to fit)
  zoomAt: (screenX: number, screenY: number, dz: number) => void; // wheel zoom to cursor
  panBy: (dx: number, dy: number) => void;
  screenToWorld: (sx: number, sy: number) => { x: number; y: number };
  worldToScreen: (wx: number, wy: number) => { x: number; y: number };

  destroy: () => void;
};

export function createStage(app: Application, worldSizeInit: number): Stage {
  const root = new Container();        // this is the “world” node we scale/translate
  app.stage.addChild(root);

  // layers
  const height = new Sprite();
  const biome = new Sprite();
  const rivers = new Sprite();
  root.addChild(height, biome, rivers);

  let worldSize = worldSizeInit;
  let fitMode: FitMode = "cover";

  // camera state
  let fitScale = 1;     // computed on resize to fit screen
  let userZoom = 1;     // multiplicative on top of fitScale
  let minZoom = 1;    // clamp (relative to fitScale)
  let maxZoom = 8;

  // add this helper (keep it near other helpers)
  function clampPan() {
    const s = currentScale();
    const worldPx = worldSize * s;
    const w = app.renderer.width;
    const h = app.renderer.height;

    // allowed top-left range so the world always covers the viewport
    const minX = Math.min(0, w - worldPx);
    const maxX = 0;
    const minY = Math.min(0, h - worldPx);
    const maxY = 0;

    if (root.position.x < minX) root.position.x = minX;
    if (root.position.x > maxX) root.position.x = maxX;
    if (root.position.y < minY) root.position.y = minY;
    if (root.position.y > maxY) root.position.y = maxY;
  }

  function applyTexture(s: Sprite, t: Texture) {
    s.texture = t;
    // crisp pixels
    s.texture.source.scaleMode = SCALE_MODES.LINEAR;
  }

  function setTerrainTexture(t: Texture) { applyTexture(biome, t);}
  function setHeightTexture(t: Texture) { applyTexture(height, t); }
  function setBiomeTexture(t: Texture)  { applyTexture(biome,  t); }
  function setRiversTexture(t: Texture) { applyTexture(rivers, t); }

  function setWorldSize(n: number) {
    worldSize = n;
    resize();
  }

  function setFitMode(m: FitMode) {
    fitMode = m;
    resize();
  }

  function currentScale() {
    return fitScale * userZoom;
  }

  function clampZoom(z: number) {
    return Math.max(minZoom, Math.min(maxZoom, z));
  }

  function setZoom(zAbs: number) {
    userZoom = clampZoom(zAbs);
    const s = currentScale();
    root.scale.set(s, s);
    clampPan(); // <-- add
  }

  function zoomAt(sx: number, sy: number, dz: number) {
    const before = screenToWorld(sx, sy);
    setZoom(clampZoom(userZoom * dz));
    const after  = screenToWorld(sx, sy);

    const dx = (after.x - before.x) * currentScale();
    const dy = (after.y - before.y) * currentScale();
    root.position.x += dx;
    root.position.y += dy;

    clampPan(); // <-- add
  }

  function panBy(dx: number, dy: number) {
    root.position.x += dx;
    root.position.y += dy;
    clampPan(); // <-- add
  }

  function resize() {
    const w = app.renderer.width;
    const h = app.renderer.height;
    if (!w || !h || !worldSize) return;

    const sContain = Math.min(w, h) / worldSize;
    const sCover   = Math.max(w, h) / worldSize;
    fitScale = (fitMode === "cover" ? sCover : sContain);

    const scale = currentScale();
    root.scale.set(scale, scale);

    const worldPx = worldSize * scale;
    const x = (w - worldPx) * 0.5;
    const y = (h - worldPx) * 0.5;
    root.position.set(x, y);

    clampPan(); // <-- add
  }


  function screenToWorld(sx: number, sy: number) {
    const s = currentScale();
    const wx = (sx - root.position.x) / s;
    const wy = (sy - root.position.y) / s;
    return { x: wx, y: wy };
  }

  function worldToScreen(wx: number, wy: number) {
    const s = currentScale();
    const sx = wx * s + root.position.x;
    const sy = wy * s + root.position.y;
    return { x: sx, y: sy };
  }

  function destroy() {
    for (const spr of [height, biome, rivers]) {
      const src = spr.texture?.source as { destroy?: () => void } | undefined;
      spr.texture?.destroy();
      src?.destroy?.();
    }
    root.destroy({ children: true });
  }

  // first layout
  resize();

  return {
    root,
    setWorldSize,
    setFitMode,
    setHeightTexture,
    setBiomeTexture,
    setRiversTexture,
    setTerrainTexture,
    resize,
    setZoom,
    zoomAt,
    panBy,
    screenToWorld,
    worldToScreen,
    destroy,
  };
}

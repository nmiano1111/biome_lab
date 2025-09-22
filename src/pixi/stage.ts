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
  setWorldPixelScale: (s: number) => void;
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
  const root = new Container();
  app.stage.addChild(root);

  // layers (add a real terrain layer)
  const height  = new Sprite();
  const biome   = new Sprite();
  const rivers  = new Sprite();
  const terrain = new Sprite();  // <-- add
  root.addChild(terrain, rivers, biome, height); // order: terrain under rivers, etc.

  let worldSize = worldSizeInit;
  let fitMode: FitMode = "cover";

  let fitScale = 1;
  let userZoom = 1;
  const MIN_OVERFIT = 1.12;   // tune: 1.08..1.2 feels good
  let minZoom = MIN_OVERFIT;
  let maxZoom = 8;

  // add near your other state
  let worldPixelScale = 4; // e.g. 4 px per sim sample

  function worldSizePx() { return worldSize * worldPixelScale; }

  function currentScale() { return fitScale * userZoom; }
  function clampZoom(z: number) {
    return Math.max(minZoom, Math.min(maxZoom, z));
  }

  function setZoom(zAbs: number) {
    userZoom = clampZoom(zAbs);
    const s = currentScale();
    root.scale.set(s, s);
    clampPan();
  }

  let initialized = false;

  function resize() {
    const w = app.renderer.width, h = app.renderer.height;
    if (!w || !h || !worldSize) return;

    const wp = worldSizePx();
    const sContain = Math.min(w, h) / wp;
    const sCover   = Math.max(w, h) / wp;
    fitScale = (fitMode === "cover" ? sCover : sContain);

    setZoom(userZoom); // re-apply with clamp

    if (!initialized) {
      const worldPxScaled = wp * currentScale();
      root.position.set((w - worldPxScaled) * 0.5, (h - worldPxScaled) * 0.5);
      initialized = true;
    }
    clampPan();
  }

  function setFitMode(m: FitMode) {
    fitMode = m;
    resize();  // setZoom() is called inside resize()
  }

  function applyTexture(s: Sprite, t: Texture) {
    s.texture = t;
    // For crisp tiles, prefer NEAREST. Keep LINEAR if you want smooth.
    s.texture.source.scaleMode = SCALE_MODES.NEAREST;
    sizeLayerToWorld(s); // <-- size sprite to world pixels
  }

  // *** BUG FIX: terrain should set 'terrain', not 'biome'
  function setTerrainTexture(t: Texture) { applyTexture(terrain, t); }
  function setHeightTexture(t: Texture)  { applyTexture(height,  t); }
  function setBiomeTexture(t: Texture)   { applyTexture(biome,   t); }
  function setRiversTexture(t: Texture)  { applyTexture(rivers,  t); }

  function setWorldPixelScale(s: number) {
    worldPixelScale = Math.max(1, s | 0);
    [height, biome, rivers, terrain].forEach(sizeLayerToWorld);
    resize();
  }

  function sizeLayerToWorld(s: Sprite) {
    s.width = worldSizePx();
    s.height = worldSizePx();
  }

  function clampPan() {
    const s = currentScale();
    const worldPx = worldSizePx() * s;
    const w = app.renderer.width, h = app.renderer.height;
    const minX = Math.min(0, w - worldPx), maxX = 0;
    const minY = Math.min(0, h - worldPx), maxY = 0;
    if (root.position.x < minX) root.position.x = minX;
    if (root.position.x > maxX) root.position.x = maxX;
    if (root.position.y < minY) root.position.y = minY;
    if (root.position.y > maxY) root.position.y = maxY;
  }

  function setWorldSize(n: number) {
    worldSize = n;
    // keep all layers sized to new world size
    [height, biome, rivers, terrain].forEach(sizeLayerToWorld);
    resize();
  }

  // *** FIX: anchor zoom at cursor correctly
  function zoomAt(sx: number, sy: number, dz: number) {
    const before = screenToWorld(sx, sy);         // world coords under cursor
    setZoom(clampZoom(userZoom * dz));            // apply zoom
    const afterScreen = worldToScreen(before.x, before.y);
    // shift so the same world point stays under the cursor
    root.position.x += (sx - afterScreen.x);
    root.position.y += (sy - afterScreen.y);
    clampPan();
  }

  function panBy(dx: number, dy: number) {
    root.position.x += dx;
    root.position.y += dy;
    clampPan();
  }

  function screenToWorld(sx: number, sy: number) {
    const s = currentScale();
    return { x: (sx - root.position.x) / s, y: (sy - root.position.y) / s };
  }

  function worldToScreen(wx: number, wy: number) {
    const s = currentScale();
    return { x: wx * s + root.position.x, y: wy * s + root.position.y };
  }

  function destroy() {
    for (const spr of [height, biome, rivers, terrain]) {
      const src = spr.texture?.source as { destroy?: () => void } | undefined;
      spr.texture?.destroy();
      src?.destroy?.();
    }
    root.destroy({ children: true });
  }

  resize();

  return {
    root,
    setWorldSize,
    setFitMode,
    setHeightTexture,
    setBiomeTexture,
    setRiversTexture,
    setTerrainTexture,
    setWorldPixelScale,
    resize,
    setZoom,
    zoomAt,
    panBy,
    screenToWorld,
    worldToScreen,
    destroy,
  };
}


import { useState, useCallback } from "react";
import PixiCanvas from "./PixiCanvas";
import { LeftPanel } from "./components/panels";
import { ProgressHud, FpsHud } from "./components/hud";
import { useUIStore } from "./state/store";

export default function App() {
  const { params, setParams, seed, setSeed } = useUIStore();
  const [open, setOpen] = useState(true);
  const [progress, setProgress] = useState<{phase?: string; pct?: number}>({});

  const reseed = useCallback(
    () => setSeed(Math.floor(Math.random() * 1e9)),
    [setSeed]
  );

  return (
    <div className="app-root">
      <PixiCanvas
        className="pixi-fill"
        onProgress={(phase, pct) => setProgress({ phase, pct })}
      />

      <LeftPanel open={open} onToggle={() => setOpen(!open)} onReseed={reseed} />

      <div className="hud" style={{ position: "absolute", top: 12, right: 12, display: "grid", gap: 8 }}>
        <FpsHud />
        <ProgressHud phase={progress.phase} pct={progress.pct} />
        <button className="hud-btn" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide (T)" : "Show (T)"}
        </button>
      </div>
    </div>
  );
}

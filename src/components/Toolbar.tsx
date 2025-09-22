// /src/Toolbar.tsx
import { useUIStore } from "../state/store";
import type { Brush, SimParams } from "../model/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  onReseed: () => void;
  seed: number;
  setSeed: (n: number) => void;
  params: SimParams;
  setParams: (p: Partial<SimParams>) => void;
};

export default function Toolbar({
                                  open,
                                  onClose,
                                  onOpen,
                                  onReseed,
                                  seed,
                                  setSeed,
                                  params,
                                  setParams,
                                }: Props) {
  const brush = useUIStore((s) => s.brush);
  const setBrush = useUIStore((s) => s.setBrush);

  return (
    <aside className={`toolbar ${open ? "open" : "closed"}`}>
      <div className="toolbar-header">
        <strong>BiomeLab</strong>
        <button className="icon-btn" onClick={open ? onClose : onOpen}>
          {open ? "⟨" : "⟩"}
        </button>
      </div>

      {/* Content scroll area */}
      <div className="toolbar-scroll">
        {/* World */}
        <Section title="World">
          <Row>
            <label className="label">Seed</label>
            <input
              className="num"
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
            />
            <button className="btn" onClick={onReseed}>Random</button>
          </Row>
          <Row>
            <label className="label">Size</label>
            <select
              className="num"
              value={params.size}
              onChange={(e) => setParams({ size: Number(e.target.value) })}
            >
              {[256, 384, 512, 768, 1024].map((s) => (
                <option key={s} value={s}>{s}×{s}</option>
              ))}
            </select>
          </Row>
        </Section>

        {/* Noise */}
        <Section title="Noise">
          <Slider
            label="Octaves" value={params.noise.octaves} min={1} max={8} step={1}
            onChange={(v) => setParams({ noise: { ...params.noise, octaves: v } })}
          />
          <Slider
            label="Lacunarity" value={params.noise.lacunarity} min={1} max={4} step={0.1}
            onChange={(v) => setParams({ noise: { ...params.noise, lacunarity: v } })}
          />
          <Slider
            label="Gain" value={params.noise.gain} min={0.1} max={0.9} step={0.05}
            onChange={(v) => setParams({ noise: { ...params.noise, gain: v } })}
          />
          <Slider
            label="Warp" value={params.noise.warp} min={0} max={80} step={1}
            onChange={(v) => setParams({ noise: { ...params.noise, warp: v } })}
          />
        </Section>

        {/* Climate */}
        <Section title="Climate">
          <Slider
            label="Sea Level" value={params.climate.seaLevel} min={0} max={1} step={0.01}
            onChange={(v) => setParams({ climate: { ...params.climate, seaLevel: v } })}
          />
          <Slider
            label="Temp Lapse" value={params.climate.tempLapse} min={0} max={1} step={0.01}
            onChange={(v) => setParams({ climate: { ...params.climate, tempLapse: v } })}
          />
          <Slider
            label="Moisture Shift" value={params.climate.moistureShift} min={-0.5} max={0.5} step={0.01}
            onChange={(v) => setParams({ climate: { ...params.climate, moistureShift: v } })}
          />
          <Slider
            label="River Thresh" value={params.riverThreshold} min={0.001} max={0.1} step={0.001}
            onChange={(v) => setParams({ riverThreshold: v })}
          />
        </Section>

        {/* Brush */}
        <Section title="Brush">
          <Row>
            <label className="label">Kind</label>
            <select
              className="num"
              value={brush.kind}
              onChange={(e) => setBrush({ kind: e.target.value as Brush["kind"] })}
            >
              <option value="raise">raise</option>
              <option value="lower">lower</option>
              <option value="smooth">smooth</option>
              <option value="rain">rain</option>
            </select>
          </Row>
          <Slider
            label="Radius" value={brush.radius} min={1} max={128} step={1}
            onChange={(v) => setBrush({ radius: v })}
          />
          <Slider
            label="Strength" value={brush.strength} min={0.01} max={1} step={0.01}
            onChange={(v) => setBrush({ strength: v })}
          />
        </Section>
      </div>
    </aside>
  );
}

/* ---- small subcomponents ---- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="section-title">{title}</div>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="row">{children}</div>;
}

function Slider({
                  label, value, min, max, step = 1, onChange,
                }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <input
          className="num"
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <input
        className="range"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

import React from "react";
import { useUIStore } from "../../state/store";
import type { Brush } from "../../model/types";

type Props = {
  open: boolean;
  onToggle: () => void;
  onReseed: () => void;
};

export default function LeftPanel({ open, onToggle, onReseed }: Props) {
  const { seed, setSeed, params, setParams, brush, setBrush } = useUIStore();

  return (
    <aside style={{ ...wrap, transform: open ? "translateX(0)" : "translateX(-16px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}>
  <div style={header}>
    <strong>BiomeLab</strong>
    <button style={btn} onClick={onToggle}>{open ? "⟨" : "⟩"}</button>
    </div>

    <div style={scroll}>
  <Section title="World">
    <Row>
      <Label>Seed</Label>
    <input style={num} type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
  <button style={btn} onClick={onReseed}>Random</button>
    </Row>
    <Row>
    <Label>Size</Label>
    <select style={num} value={params.size} onChange={(e) => setParams({ size: Number(e.target.value) })}>
  {[256, 384, 512, 768, 1024].map((s) => <option key={s} value={s}>{s}×{s}</option>)}
  </select>
  </Row>
  </Section>

  <Section title="Noise">
  <Slider label="Octaves" value={params.noise.octaves} min={1} max={8} step={1}
    onChange={(v) => setParams({ noise: { ...params.noise, octaves: v } })}/>
  <Slider label="Lacunarity" value={params.noise.lacunarity} min={1} max={4} step={0.1}
    onChange={(v) => setParams({ noise: { ...params.noise, lacunarity: v } })}/>
  <Slider label="Gain" value={params.noise.gain} min={0.1} max={0.9} step={0.05}
    onChange={(v) => setParams({ noise: { ...params.noise, gain: v } })}/>
  <Slider label="Warp" value={params.noise.warp} min={0} max={80} step={1}
    onChange={(v) => setParams({ noise: { ...params.noise, warp: v } })}/>
  </Section>

  <Section title="Climate">
  <Slider label="Sea Level" value={params.climate.seaLevel} min={0} max={1} step={0.01}
    onChange={(v) => setParams({ climate: { ...params.climate, seaLevel: v } })}/>
  <Slider label="Temp Lapse" value={params.climate.tempLapse} min={0} max={1} step={0.01}
    onChange={(v) => setParams({ climate: { ...params.climate, tempLapse: v } })}/>
  <Slider label="Moisture Shift" value={params.climate.moistureShift} min={-0.5} max={0.5} step={0.01}
    onChange={(v) => setParams({ climate: { ...params.climate, moistureShift: v } })}/>
  <Slider label="River Thresh" value={params.riverThreshold} min={0.001} max={0.1} step={0.001}
    onChange={(v) => setParams({ riverThreshold: v })}/>
  </Section>

  <Section title="Brush">
    <Row>
      <Label>Kind</Label>
    <select style={num} value={brush.kind} onChange={(e) => setBrush({ kind: e.target.value as Brush["kind"] })}>
    <option value="raise">raise</option>
      <option value="lower">lower</option>
    <option value="smooth">smooth</option>
    <option value="rain">rain</option>
    </select>
    </Row>
    <Slider label="Radius" value={brush.radius} min={1} max={128} step={1}
    onChange={(v) => setBrush({ radius: v })}/>
  <Slider label="Strength" value={brush.strength} min={0.01} max={1} step={0.01}
    onChange={(v) => setBrush({ strength: v })}/>
  </Section>
  </div>
  </aside>
  );
  }

  /* --- little subcomponents & styles --- */

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section style={{ marginBottom: 12 }}>
    <div style={sectionTitle}>{title}</div>
    {children}
    </section>
  );
  }
  function Row({ children }: { children: React.ReactNode }) {
    return <div style={row}>{children}</div>;
  }
  function Label({ children }: { children: React.ReactNode }) {
    return <span style={label}>{children}</span>;
  }
function Slider({ label: l, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <span>{l}</span>
        <input
          style={num}
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <input
        style={range}
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


const wrap: React.CSSProperties = {
    position: "absolute",
    top: 12, bottom: 12, left: 12,
    width: 320,
    background: "rgba(20, 24, 32, 0.7)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    backdropFilter: "blur(8px)",
    transition: "transform 160ms ease, opacity 160ms ease",
    display: "flex",
    flexDirection: "column",
    color: "#e5e7eb",
  };
  const header: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)",
  };
  const scroll: React.CSSProperties = { padding: "10px 12px", overflow: "auto" };
  const btn: React.CSSProperties = {
    background: "transparent", color: "#e5e7eb",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px", cursor: "pointer",
  };
  const row: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", marginBottom: 8,
  };
  const label: React.CSSProperties = { color: "#9ca3af" };
  const sectionTitle: React.CSSProperties = {
    fontSize: 12, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8,
  };
  const num: React.CSSProperties = {
    color: "#e5e7eb", background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8, padding: "6px 8px",
  };
  const range: React.CSSProperties = { width: "100%", height: 28 };

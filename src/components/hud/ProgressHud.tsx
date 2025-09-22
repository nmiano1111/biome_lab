import React from "react";

type Props = { phase?: string; pct?: number };

export default function ProgressHud({ phase, pct }: Props) {
  if (!phase || pct == null) return null;
  const percent = Math.round(pct * 100);

  return (
    <div style={wrap}>
      <div style={row}>
        <span style={label}>Phase</span>
        <span>{phase}</span>
      </div>
      <div style={{ ...bar, position: "relative" }}>
        <div style={{ ...fill, width: `${percent}%` }} />
        <span style={barText}>{percent}%</span>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  background: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: 8,
  minWidth: 180,
  color: "#e5e7eb",
};
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 6 };
const label: React.CSSProperties = { color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em" };
const bar: React.CSSProperties = { height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 6, overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", background: "#60a5fa" };
const barText: React.CSSProperties = { position: "absolute", top: -18, right: 0, fontSize: 12, color: "#9ca3af" };

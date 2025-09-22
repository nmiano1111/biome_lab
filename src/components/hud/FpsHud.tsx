import React from "react";
import { useFps } from "./useFps";

export default function FpsHud() {
  const fps = useFps(500);
  return (
    <div style={wrap}>
      <span style={num}>{fps}</span>
      <span style={lbl}>FPS</span>
    </div>
  );
}

const wrap: React.CSSProperties = {
  background: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "6px 8px",
  color: "#e5e7eb",
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
};
const num: React.CSSProperties = { fontWeight: 600 };
const lbl: React.CSSProperties = { fontSize: 12, color: "#9ca3af" };

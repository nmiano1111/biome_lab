import type { SimParams, Brush, Fields } from "../model/types";

export type MsgInit = { t: 'init'; seed: number; params: SimParams };
export type MsgRecompute = { t: 'recompute'; params: SimParams };
export type MsgBrush = { t: 'brush'; x: number; y: number; brush: Brush };
export type MsgResult = { t: 'result'; fields: Fields };
export type MsgProgress = { t: 'progress'; phase: string; pct: number };
export type WorkerIn = MsgInit | MsgRecompute | MsgBrush;
export type WorkerOut = MsgResult | MsgProgress;

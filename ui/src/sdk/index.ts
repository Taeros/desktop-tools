// The public UI API for tools. Tool UI code imports ONLY from "@sdk" (see docs/TOOL_GUIDE.md).
// Changing anything exported here requires an ADR.

import type { ComponentType } from "react";
import { api } from "../core/api";
import { getState, toast, useStore } from "../core/store";
import type { AppSettings, Entry, Size } from "../core/types";

export { useEffect, useMemo, useRef, useState, useCallback, Fragment } from "react";
export { Icon } from "./icons";
export { Stat, Sparkline, Segmented, Badge, Empty, CardTitle, Fact, RangeBar, Bars } from "./components";
export type { Size, Location, AppSettings } from "../core/types";

// ---------------------------------------------------------------- tool registration
export interface CardProps { size: Size }
export interface CardDef { id: string; render: ComponentType<CardProps> }
export interface ToolUI { cards: CardDef[]; Page?: ComponentType }

export const defineCard = (def: CardDef): CardDef => def;
export const defineTool = (def: ToolUI): ToolUI => def;

// ---------------------------------------------------------------- data hooks
/** Latest published state of a provider. Inside a card it is never undefined (the card host waits for data). */
export function useProvider<T>(toolId: string): T {
  return useStore((s) => s.state[toolId]?.data) as T;
}
export function useEntry(toolId: string): Entry | undefined {
  return useStore((s) => s.state[toolId]);
}
export function useApp(): AppSettings {
  return useStore((s) => s.app) as AppSettings;
}
export function useToolSettings<T = Record<string, any>>(toolId: string): T {
  return useStore((s) => s.tools[toolId]?.settings) as T;
}

/** Call a provider action. Errors are shown as a toast and re-thrown. */
export async function callAction<T = unknown>(tool: string, name: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await api.action<T>(tool, name, args);
  } catch (e) {
    toast((e as Error).message, "error");
    throw e;
  }
}

export async function saveToolSettings(tool: string, patch: Record<string, unknown>): Promise<void> {
  const cur = getState().tools[tool]?.settings ?? {};
  try {
    await api.setToolSettings(tool, { ...cur, ...patch });
  } catch (e) {
    toast((e as Error).message, "error");
  }
}

// ---------------------------------------------------------------- formatting (respects universal settings)
const app = () => getState().app;

export function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  const r = Number(v.toFixed(digits));
  return (Object.is(r, -0) ? 0 : r).toFixed(digits);
}
export const fmtTemp = (v: number | null | undefined) => `${fmtNum(v)}°`;
export function fmtPct(v: number | null | undefined, digits = 2, sign = true): string {
  if (v === null || v === undefined) return "--";
  return `${sign && v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

/** "HH:MM" from hours/minutes, honouring the 24 h / 12 h setting. */
export function fmtHM(h: number, m: number, opts: { seconds?: number; short?: boolean } = {}): string {
  const s = opts.seconds !== undefined ? `:${String(opts.seconds).padStart(2, "0")}` : "";
  if ((app()?.time_format ?? "24h") === "24h") return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}${s}`;
  const h12 = h % 12 || 12;
  const suffix = h < 12 ? "am" : "pm";
  if (opts.short && m === 0) return `${h12}${suffix}`;
  return `${h12}:${String(m).padStart(2, "0")}${s} ${suffix}`;
}
/** Time part of a location-local ISO string like "2026-11-03T20:00". */
export function fmtIsoTime(iso: string | null | undefined, short = false): string {
  if (!iso || iso.length < 16) return "--";
  return fmtHM(Number(iso.slice(11, 13)), Number(iso.slice(14, 16)), { short });
}
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Tue 3 Nov" (or "Tue Nov 3"). Accepts "YYYY-MM-DD" or a Date. */
export function fmtDate(d: string | Date, withMonth = true): string {
  const dt = typeof d === "string" ? new Date(`${d.slice(0, 10)}T12:00:00`) : d;
  const day = DOW[dt.getDay()];
  if (!withMonth) return day;
  return (app()?.date_style ?? "day-month") === "day-month"
    ? `${day} ${dt.getDate()} ${MON[dt.getMonth()]}` : `${day} ${MON[dt.getMonth()]} ${dt.getDate()}`;
}
export const fmtDow = (d: string) => DOW[new Date(`${d.slice(0, 10)}T12:00:00`).getDay()];

/** Re-render every `ms` milliseconds (for clocks). */
export { useTick } from "./tick";

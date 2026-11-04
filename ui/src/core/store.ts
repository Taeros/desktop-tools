// One tiny global store fed by /api/bootstrap and the WebSocket. Components subscribe with hooks.

import { useSyncExternalStore } from "react";
import { api, connectLive } from "./api";
import type { AppSettings, Bootstrap, Entry, Layout, ToolInfo } from "./types";

export interface StoreState {
  ready: boolean;
  error: string;
  connected: boolean;
  boot: Bootstrap | null;
  app: AppSettings | null;
  layout: Layout | null;
  tools: Record<string, ToolInfo>;
  state: Record<string, Entry>;
  toasts: { id: number; text: string; kind: "info" | "error" }[];
}

let s: StoreState = { ready: false, error: "", connected: false, boot: null, app: null, layout: null, tools: {}, state: {}, toasts: [] };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function set(patch: Partial<StoreState>) { s = { ...s, ...patch }; emit(); }
export const getState = () => s;

export function useStore<T>(select: (st: StoreState) => T): T {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => select(s));
}

let toastId = 0;
export function toast(text: string, kind: "info" | "error" = "info") {
  const id = ++toastId;
  set({ toasts: [...s.toasts, { id, text, kind }] });
  setTimeout(() => set({ toasts: s.toasts.filter((t) => t.id !== id) }), kind === "error" ? 6000 : 3000);
}

function onMessage(msg: any) {
  switch (msg.type) {
    case "snapshot": set({ state: msg.state }); break;
    case "state": set({ state: { ...s.state, [msg.tool]: msg.entry } }); break;
    case "app": set({ app: msg.app }); break;
    case "layout": set({ layout: msg.layout }); break;
    case "shell": if (s.boot) set({ boot: { ...s.boot, shell: msg.shell } }); break;
    case "tool_settings": {
      const t = s.tools[msg.tool];
      if (t) set({ tools: { ...s.tools, [msg.tool]: { ...t, settings: msg.settings } } });
      break;
    }
  }
}

export async function reloadBoot() {
  const boot = await api.bootstrap();
  const tools = Object.fromEntries(boot.tools.map((t) => [t.manifest.id, t]));
  set({ boot, app: boot.app, layout: boot.layout, tools, state: { ...boot.state, ...s.state } });
}

export async function start() {
  try {
    await reloadBoot();
    set({ ready: true });
    connectLive(onMessage, (connected) => {
      set({ connected });
      if (connected) reloadBoot().catch(() => undefined);
    });
  } catch (e) {
    set({ error: (e as Error).message });
  }
}

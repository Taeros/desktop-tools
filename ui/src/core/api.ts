// Talks to the local engine. The per-launch token arrives in the URL fragment (#token=...), is kept in
// sessionStorage for reloads, and is removed from the address bar immediately.

import type { Bootstrap, Entry, Layout, AppSettings } from "./types";

function readToken(): string {
  if (typeof location === "undefined") return ""; // unit tests (no browser)
  const m = location.hash.match(/token=([^&]+)/);
  if (m) {
    sessionStorage.setItem("dt-token", m[1]);
    history.replaceState(null, "", location.pathname + location.search);
    return m[1];
  }
  return sessionStorage.getItem("dt-token") ?? "";
}

const TOKEN = readToken();

export class ApiError extends Error {}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "X-DT-Token": TOKEN, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new ApiError("Your session ended. Reopen Desktop Tools from the tray icon.");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail ?? data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  bootstrap: () => call<Bootstrap>("GET", "/bootstrap"),
  health: () => call<{ state: Record<string, Entry>; logs: { time: string; level: string; logger: string; message: string }[] }>("GET", "/health"),
  setApp: (values: Partial<AppSettings>) => call<AppSettings>("PUT", "/settings/app", values),
  setToolSettings: (tool: string, values: unknown) => call<Record<string, unknown>>("PUT", `/tools/${tool}/settings`, values),
  action: <T = unknown>(tool: string, name: string, args: Record<string, unknown> = {}) =>
    call<{ result: T }>("POST", `/tools/${tool}/actions/${name}`, args).then((r) => r.result),
  refresh: (tool: string) => call("POST", `/tools/${tool}/refresh`),
  setEnabled: (tool: string, enabled: boolean) => call("POST", `/tools/${tool}/enabled`, { enabled }),
  approve: (tool: string) => call("POST", `/tools/${tool}/approve`),
  setSecret: (tool: string, name: string, value: string) => call("PUT", `/tools/${tool}/secrets/${name}`, { value }),
  setLayout: (layout: Layout) => call<Layout>("PUT", "/layout", layout),
  exportAll: () => call<unknown>("GET", "/export"),
  importAll: (data: unknown) => call("POST", "/import", data),
  reset: (scope: string) => call("POST", `/reset/${scope}`),
};

export function connectLive(onMessage: (msg: any) => void, onStatus: (connected: boolean) => void): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry = 500;
  const open = () => {
    ws = new WebSocket(`ws://${location.host}/api/ws?token=${encodeURIComponent(TOKEN)}`);
    ws.onopen = () => { retry = 500; onStatus(true); };
    ws.onmessage = (ev) => { try { onMessage(JSON.parse(ev.data)); } catch { /* ignore malformed */ } };
    ws.onclose = () => {
      onStatus(false);
      if (!stopped) setTimeout(open, (retry = Math.min(retry * 2, 8000)));
    };
  };
  open();
  return () => { stopped = true; ws?.close(); };
}

// The universal Settings page: app-wide and shared settings, layout, tools, data and system health.

import { useEffect, useState } from "react";
import { api } from "../core/api";
import { reloadBoot, toast, useStore } from "../core/store";
import type { AppSettings, Entry, SidebarEntry } from "../core/types";
import { Icon, PICKABLE_ICONS } from "../sdk/icons";
import { Modal } from "../shell/Modal";
import { AutoForm } from "./AutoForm";

const TABS = [
  { id: "general", label: "General", icon: "settings" },
  { id: "units", label: "Units and formats", icon: "temperature" },
  { id: "places", label: "Saved places", icon: "map-pin" },
  { id: "appearance", label: "Appearance", icon: "palette" },
  { id: "layout", label: "Layout", icon: "sidebar" },
  { id: "tools", label: "Tools", icon: "tools" },
  { id: "data", label: "Data and privacy", icon: "database" },
  { id: "system", label: "System", icon: "activity" },
];

async function saveApp(values: Partial<AppSettings>) {
  try { await api.setApp(values); } catch (e) { toast((e as Error).message, "error"); }
}

export function SettingsPage({ initial, onNavigate }: { initial?: string; onNavigate: (p: string) => void }) {
  const [tab, setTab] = useState(initial && TABS.some((t) => t.id === initial) ? initial : "general");
  const app = useStore((s) => s.app)!;
  const schema = useStore((s) => s.boot?.app_schema)!;
  const appForm = (only: string[]) => (
    <AutoForm schema={schema} value={app as any} only={only}
      onChange={(v) => {
        const changed = Object.fromEntries(only.filter((k) => JSON.stringify(v[k]) !== JSON.stringify((app as any)[k])).map((k) => [k, v[k]]));
        if (Object.keys(changed).length) saveApp(changed);
      }} />
  );
  const hotkeySchema = { ...schema, properties: { ...schema.properties, hotkey: { ...schema.properties!.hotkey, "x-widget": "hotkey" } } };

  return (
    <div className="page settings">
      <header className="page-head"><h1>Settings</h1></header>
      <div className="settings-body">
        <nav className="tabs" aria-label="Settings sections">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="tab-panel">
          {tab === "general" && (<>
            <AutoForm schema={hotkeySchema} value={app as any} only={["hotkey", "start_at_login"]}
              onChange={(v) => {
                if (v.hotkey !== app.hotkey) saveApp({ hotkey: v.hotkey });
                if (v.start_at_login !== app.start_at_login) saveApp({ start_at_login: v.start_at_login });
              }} />
            <StartPage />
          </>)}
          {tab === "units" && appForm(["units", "time_format", "date_style", "first_day"])}
          {tab === "places" && (<>
            <p className="muted">Saved places are shared by every tool: Weather offers them as locations and Clocks shows their time.</p>
            {appForm(["locations", "use_my_location"])}
          </>)}
          {tab === "appearance" && (<>
            <ThemePresets />
            <AutoForm schema={schema.$defs!.ThemeSettings} root={schema} value={app.theme as any}
              onChange={(v) => saveApp({ theme: v as AppSettings["theme"] })} />
          </>)}
          {tab === "layout" && <LayoutEditor />}
          {tab === "tools" && <ToolsPanel onNavigate={onNavigate} />}
          {tab === "data" && <DataPanel />}
          {tab === "system" && <SystemPanel />}
        </div>
      </div>
    </div>
  );
}

function StartPage() {
  const sidebar = useStore((s) => s.layout?.sidebar) ?? [];
  const start = useStore((s) => s.app?.start_page);
  return (
    <div className="form"><div className="field">
      <div className="field-label"><div>Start page</div><div className="muted">Shown when the control center opens</div></div>
      <div className="field-control">
        <select value={start} onChange={(e) => saveApp({ start_page: e.target.value })}>
          {sidebar.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>
    </div></div>
  );
}

const PRESETS = [
  { name: "Sunset slate", theme: { mode: "dark", accent: "#7EB0DE", warm: "#F08C46" } },
  { name: "Midnight", theme: { mode: "dark", accent: "#9D8CF2", warm: "#E8A85A" } },
  { name: "Forest", theme: { mode: "dark", accent: "#6FC3A0", warm: "#E9B35F" } },
  { name: "Paper", theme: { mode: "light", accent: "#2F6FB0", warm: "#C8622A" } },
] as const;

function ThemePresets() {
  const theme = useStore((s) => s.app?.theme)!;
  return (
    <div className="presets">
      {PRESETS.map((p) => (
        <button key={p.name} className="preset" onClick={() => saveApp({ theme: { ...theme, ...p.theme } })}>
          <span className={`swatch ${p.theme.mode}`}><i style={{ background: p.theme.accent }} /><i style={{ background: p.theme.warm }} /></span>
          {p.name}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- layout: sidebar editor
function LayoutEditor() {
  const layout = useStore((s) => s.layout)!;
  const save = async (sidebar: SidebarEntry[], dashboards = layout.dashboards) => {
    try { await api.setLayout({ ...layout, sidebar, dashboards }); } catch (e) { toast((e as Error).message, "error"); }
  };
  const list = layout.sidebar;
  const update = (i: number, patch: Partial<SidebarEntry>) => save(list.map((e, k) => (k === i ? { ...e, ...patch } : e)));
  const move = (i: number, d: number) => { const n = [...list]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); save(n); };
  const addDashboard = () => {
    const id = Math.random().toString(36).slice(2, 8);
    save([...list, { id: `dash:${id}`, title: "New dashboard", icon: "dashboard", hidden: false }],
      { ...layout.dashboards, [id]: { cards: [] } });
  };
  const remove = (i: number) => {
    const e = list[i];
    const { [e.id.slice(5)]: _, ...rest } = layout.dashboards;
    save(list.filter((_x, k) => k !== i), rest);
  };
  return (
    <>
      <p className="muted">Every page is one click away in the sidebar. Rename pages, choose icons, reorder, hide, or add dashboards. Settings always stays last.</p>
      <ul className="rows sidebar-editor">
        {list.map((e, i) => (
          <li key={e.id}>
            <select className="icon-select" value={e.icon} onChange={(ev) => update(i, { icon: ev.target.value })} aria-label="Icon">
              {[...new Set([e.icon, ...PICKABLE_ICONS])].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Icon name={e.icon} />
            <input className="inline" defaultValue={e.title} onBlur={(ev) => ev.target.value !== e.title && update(i, { title: ev.target.value })} aria-label="Page name" />
            <span className="muted">{e.id === "home" ? "dashboard" : e.id.startsWith("dash:") ? "dashboard" : "tool page"}</span>
            <span className="row-actions">
              <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="up" /></button>
              <button className="icon-btn" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="down" /></button>
              <button className="icon-btn" disabled={e.id === "home"} onClick={() => update(i, { hidden: !e.hidden })} aria-label={e.hidden ? "Show" : "Hide"}>
                <Icon name={e.hidden ? "eye-off" : "eye"} /></button>
              {e.id.startsWith("dash:") && <button className="icon-btn" onClick={() => remove(i)} aria-label="Delete"><Icon name="trash" /></button>}
            </span>
          </li>
        ))}
      </ul>
      <div className="row-buttons">
        <button onClick={addDashboard}><Icon name="plus" /> Add dashboard page</button>
        <button onClick={() => api.reset("layout").then(() => toast("Layout reset"))}><Icon name="refresh" /> Reset layout</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- tools
function ToolsPanel({ onNavigate }: { onNavigate: (p: string) => void }) {
  const tools = useStore((s) => s.tools);
  const state = useStore((s) => s.state);
  const [open, setOpen] = useState<string | null>(null);
  const tool = open ? tools[open] : null;
  return (
    <>
      <ul className="rows tools-list">
        {Object.values(tools).map((t) => {
          const st = state[t.manifest.id]?.status ?? "loading";
          return (
            <li key={t.manifest.id}>
              <Icon name={t.manifest.icon} />
              <div className="grow"><div>{t.manifest.name} <span className="muted">v{t.manifest.version}</span></div>
                <div className="muted">{t.manifest.description}</div></div>
              <span className={`status status-${st}`}>{st === "ok" ? "Running" : st}</span>
              {!t.approved && <button className="primary" onClick={() => setOpen(t.manifest.id)}>Review</button>}
              <button onClick={() => setOpen(t.manifest.id)}>Settings</button>
              <label className="switch" title={t.enabled ? "Enabled" : "Disabled"}>
                <input type="checkbox" checked={t.enabled} onChange={async (e) => { await api.setEnabled(t.manifest.id, e.target.checked); await reloadBoot(); }} /><span />
              </label>
            </li>
          );
        })}
      </ul>
      {tool && (
        <Modal title={tool.manifest.name} onClose={() => setOpen(null)} wide>
          <Permissions tool={tool.manifest.id} />
          <h3>Settings</h3>
          {tool.settings_schema ? (
            <AutoForm schema={tool.settings_schema} value={tool.settings ?? {}}
              onChange={async (v) => { try { await api.setToolSettings(tool.manifest.id, v); } catch (e) { toast((e as Error).message, "error"); } }} />
          ) : <div className="muted">No settings.</div>}
          {tool.manifest.page && <div className="row-buttons"><button onClick={() => { setOpen(null); onNavigate(`tool:${tool.manifest.id}`); }}>Open {tool.manifest.name}</button></div>}
        </Modal>
      )}
    </>
  );
}

function Permissions({ tool }: { tool: string }) {
  const t = useStore((s) => s.tools[tool]);
  const p = t.manifest.permissions;
  return (
    <div className={`perm ${t.approved ? "" : "pending"}`}>
      <div className="perm-head"><Icon name="shield" /> {t.approved ? "Permissions you approved" : "This tool is waiting for your approval"}</div>
      <ul>
        <li><b>Internet:</b> {p.network.length ? p.network.join(", ") : "none"}</li>
        <li><b>System controls:</b> {p.system.length ? p.system.join(", ") : "none"}</li>
        <li><b>Secrets:</b> {p.secrets.length ? p.secrets.join(", ") : "none"}</li>
      </ul>
      {!t.approved && <button className="primary" onClick={async () => { await api.approve(tool); await reloadBoot(); toast(`${t.manifest.name} approved`); }}>Approve and start</button>}
    </div>
  );
}

// ---------------------------------------------------------------- data
function DataPanel() {
  const dataDir = useStore((s) => s.boot?.data_dir);
  const [confirm, setConfirm] = useState(false);
  const exportFile = async () => {
    const data = await api.exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `desktop-tools-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const importFile = async (f: File) => {
    try { await api.importAll(JSON.parse(await f.text())); await reloadBoot(); toast("Settings imported"); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <>
      <div className="card-like">
        <h3>Export and import</h3>
        <p className="muted">One file with all settings and layout. Secrets and tool approvals are never included.</p>
        <div className="row-buttons">
          <button onClick={exportFile}><Icon name="download" /> Export settings</button>
          <label className="button"><Icon name="upload" /> Import settings
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} /></label>
        </div>
      </div>
      <div className="card-like">
        <h3>Privacy</h3>
        <p className="muted">Settings are stored on this PC only, in <code>{dataDir}</code>. Nothing is sent anywhere except the public data services each tool lists under its permissions. API keys, if a tool ever needs one, are kept in Windows Credential Manager.</p>
      </div>
      <div className="card-like danger">
        <h3>Reset</h3>
        <p className="muted">Restores default settings, saved places and layout.</p>
        <button className="danger" onClick={() => setConfirm(true)}><Icon name="trash" /> Reset everything</button>
      </div>
      {confirm && (
        <Modal title="Reset everything?" onClose={() => setConfirm(false)}>
          <p>This restores all default settings, saved places and layouts. It can't be undone unless you exported first.</p>
          <div className="row-buttons">
            <button onClick={() => setConfirm(false)}>Cancel</button>
            <button className="danger" onClick={async () => { await api.reset("all"); await reloadBoot(); setConfirm(false); toast("Everything reset"); }}>Reset</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------- system health
function SystemPanel() {
  const [h, setH] = useState<{ state: Record<string, Entry>; logs: { time: string; level: string; logger: string; message: string }[] } | null>(null);
  const version = useStore((s) => s.boot?.version);
  const fake = useStore((s) => s.boot?.fake);
  const load = () => api.health().then(setH).catch((e) => toast(e.message, "error"));
  useEffect(() => { load(); }, []);
  return (
    <>
      <p className="muted">Desktop Tools {version}{fake ? " · fake mode (sample data)" : ""}</p>
      <table className="table">
        <thead><tr><th>Tool</th><th>Status</th><th>Last update</th><th>Message</th></tr></thead>
        <tbody>
          {h && Object.entries(h.state).map(([k, e]) => (
            <tr key={k}><td>{k}</td><td><span className={`status status-${e.status}`}>{e.status}</span></td>
              <td>{e.updated_at ? new Date(e.updated_at * 1000).toLocaleTimeString() : "--"}</td><td className="muted">{e.error}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="row-buttons"><button onClick={load}><Icon name="refresh" /> Refresh</button></div>
      <h3>Recent log</h3>
      <pre className="log">{h?.logs.slice().reverse().map((l) => `${l.time}  ${l.level.padEnd(7)} ${l.logger}: ${l.message}`).join("\n")}</pre>
    </>
  );
}

// Special form controls referenced by settings schemas through "x-widget".

import { useEffect, useRef, useState } from "react";
import { api } from "../core/api";
import { toast, useStore } from "../core/store";
import type { Location } from "../core/types";
import { Icon } from "../sdk/icons";

// ---------------------------------------------------------------- saved places (app-wide)
export function LocationsEditor({ value, onChange }: { value: Location[]; onChange: (v: Location[]) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<(Location & { detail?: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const allowMe = useStore((s) => s.app?.use_my_location);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setResults(await api.action<(Location & { detail?: string })[]>("places", "search", { query: q })); }
      catch (e) { toast((e as Error).message, "error"); }
      finally { setBusy(false); }
    }, 350);
  }, [q]);

  const add = (loc: Location) => {
    let id = loc.id, n = 2;
    while (value.some((v) => v.id === id)) id = `${loc.id}-${n++}`;
    onChange([...value, { id, name: loc.name, region: loc.region, lat: loc.lat, lon: loc.lon, tz: loc.tz }]);
    setQ(""); setResults([]);
  };
  const addMe = async () => {
    try { add(await api.action<Location>("places", "my_location")); } catch (e) { toast((e as Error).message, "error"); }
  };
  const move = (i: number, d: number) => {
    const next = [...value]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); onChange(next);
  };
  const rename = (i: number, name: string) => onChange(value.map((v, k) => (k === i ? { ...v, name } : v)));

  return (
    <div className="locations">
      <ul className="rows">
        {value.map((l, i) => (
          <li key={l.id}>
            <Icon name="map-pin" />
            <input className="inline" value={l.name} onChange={(e) => rename(i, e.target.value)} aria-label="Name" />
            <span className="muted">{l.region} · {l.tz}</span>
            <span className="row-actions">
              <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="up" /></button>
              <button className="icon-btn" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="down" /></button>
              <button className="icon-btn" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Remove"><Icon name="trash" /></button>
            </span>
          </li>
        ))}
        {!value.length && <li className="muted">No saved places yet.</li>}
      </ul>
      <div className="search">
        <Icon name="search" />
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a place: Austin, TX" aria-label="Search places" />
        {busy && <div className="spinner small" />}
        {allowMe && <button onClick={addMe} title="Add my approximate location"><Icon name="locate" /> My location</button>}
      </div>
      {results.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}><button onClick={() => add(r)}><b>{r.name}</b> <span className="muted">{r.detail}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pick one saved place
export function LocationSelect({ value, onChange, allowMe }: { value: string; onChange: (v: string) => void; allowMe?: boolean }) {
  const locs = useStore((s) => s.app?.locations) ?? [];
  const me = useStore((s) => s.app?.use_my_location);
  return (
    <select value={value || locs[0]?.id || ""} onChange={(e) => onChange(e.target.value)}>
      {locs.map((l) => <option key={l.id} value={l.id}>{l.name}{l.region ? `, ${l.region}` : ""}</option>)}
      {allowMe && me && <option value="@me">My location (approximate)</option>}
    </select>
  );
}

// ---------------------------------------------------------------- show / hide saved places
export function LocationToggles({ hidden, onChange }: { hidden: string[]; onChange: (v: string[]) => void }) {
  const locs = useStore((s) => s.app?.locations) ?? [];
  return (
    <ul className="rows">
      {locs.map((l) => {
        const on = !hidden.includes(l.id);
        return (
          <li key={l.id}>
            <label className="switch"><input type="checkbox" checked={on}
              onChange={() => onChange(on ? [...hidden, l.id] : hidden.filter((h) => h !== l.id))} /><span /></label>
            <span>{l.name}</span><span className="muted">{l.tz}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- list of short strings
export function TagsInput({ value, onChange, uppercase }: { value: string[]; onChange: (v: string[]) => void; uppercase?: boolean }) {
  const [t, setT] = useState("");
  const add = () => {
    const v = (uppercase ? t.toUpperCase() : t).trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setT("");
  };
  return (
    <div className="tags">
      {value.map((v) => (
        <span className="tag" key={v}>{v}<button onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}><Icon name="x" size={14} /></button></span>
      ))}
      <input type="text" value={t} onChange={(e) => setT(e.target.value)} placeholder="Add…" aria-label="Add item"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} onBlur={() => t && add()} />
    </div>
  );
}

// ---------------------------------------------------------------- record a key combination
export function HotkeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);
  const onKey = (e: React.KeyboardEvent) => {
    e.preventDefault();
    if (e.key === "Escape") { setRecording(false); return; }
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
    const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Win"].filter(Boolean);
    if (!mods.length) { toast("Use at least one of Ctrl, Alt, Shift or Win", "error"); return; }
    const key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    onChange([...mods, key].join("+"));
    setRecording(false);
  };
  return (
    <button className={`hotkey ${recording ? "recording" : ""}`} onClick={() => setRecording(true)} onKeyDown={recording ? onKey : undefined}
      onBlur={() => setRecording(false)}>
      <Icon name="keyboard" /> {recording ? "Press the new shortcut… (Esc to cancel)" : value}
    </button>
  );
}

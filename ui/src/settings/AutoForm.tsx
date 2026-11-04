// Renders a settings form from a tool's JSON Schema (generated from its Pydantic settings model).
// Tools never hand-build settings UIs: add a field to the model and it appears here.

import { useEffect, useRef, useState } from "react";
import type { JsonSchema } from "../core/types";
import { HotkeyInput, LocationSelect, LocationToggles, LocationsEditor, TagsInput } from "./widgets";

function resolve(s: JsonSchema, root: JsonSchema): JsonSchema {
  if (s.$ref) return root.$defs?.[s.$ref.split("/").pop()!] ?? s;
  if (s.anyOf) return resolve(s.anyOf.find((x) => x.type !== "null") ?? s.anyOf[0], root);
  return s;
}

function labelize(key: string) { return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()); }

export function Field({ name, schema, root, value, onChange }:
  { name: string; schema: JsonSchema; root: JsonSchema; value: any; onChange: (v: any) => void }) {
  const s = { ...resolve(schema, root), ...(schema.title ? { title: schema.title } : {}), ...(schema.description ? { description: schema.description } : {}) };
  const widget = schema["x-widget"] ?? s["x-widget"];
  const title = s.title ?? labelize(name);
  let control: React.ReactNode;

  if (widget === "locations") control = <LocationsEditor value={value ?? []} onChange={onChange} />;
  else if (widget === "location") control = <LocationSelect value={value ?? ""} onChange={onChange} allowMe={!!(schema["x-allow-me"] ?? s["x-allow-me"])} />;
  else if (widget === "tags") control = <TagsInput value={value ?? []} onChange={onChange} uppercase={!!(schema["x-uppercase"] ?? s["x-uppercase"])} />;
  else if (widget === "location-toggles") control = <LocationToggles hidden={value ?? []} onChange={onChange} />;
  else if (widget === "hotkey") control = <HotkeyInput value={value ?? ""} onChange={onChange} />;
  else if (s.enum) control = (
    <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
      {s.enum.map((o) => <option key={String(o)} value={String(o)}>{labelize(String(o))}</option>)}
    </select>
  );
  else if (s.type === "boolean") control = (
    <label className="switch"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span /></label>
  );
  else if (s.format === "color") control = <input type="color" value={value ?? "#7EB0DE"} onChange={(e) => onChange(e.target.value)} />;
  else if (s.type === "number" || s.type === "integer") control = (
    <NumberInput value={value} min={s.minimum} max={s.maximum} step={s.step ?? (s.type === "integer" ? 1 : 0.1)} onChange={onChange} />
  );
  else if (s.format === "date") control = <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  else if (s.type === "object" && s.properties) {
    return (
      <fieldset className="subform">
        <legend>{title}</legend>
        <AutoForm schema={s} root={root} value={value ?? {}} onChange={onChange} />
      </fieldset>
    );
  } else control = <TextInput value={value ?? ""} onChange={onChange} />;

  const wide = widget === "locations" || widget === "location-toggles" || widget === "tags";
  return (
    <div className={`field ${wide ? "field-wide" : ""}`}>
      <div className="field-label"><div>{title}</div>{s.description && <div className="muted">{s.description}</div>}</div>
      <div className="field-control">{control}</div>
    </div>
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input type="text" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onChange(v)}
    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />;
}

function NumberInput({ value, min, max, step, onChange }:
  { value: number; min?: number; max?: number; step: number; onChange: (v: number) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (min !== undefined && max !== undefined) {
    return (
      <div className="range">
        <input type="range" min={min} max={max} step={step} value={v}
          onChange={(e) => { const n = Number(e.target.value); setV(n); clearTimeout(timer.current); timer.current = setTimeout(() => onChange(n), 250); }} />
        <span className="num">{Number(v).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
    );
  }
  return <input type="number" value={v} step={step} onChange={(e) => setV(Number(e.target.value))} onBlur={() => onChange(v)} />;
}

export function AutoForm({ schema, root, value, onChange, only, exclude }:
  { schema: JsonSchema; root?: JsonSchema; value: Record<string, any>; onChange: (v: Record<string, any>) => void;
    only?: string[]; exclude?: string[] }) {
  const r = root ?? schema;
  const props = Object.entries(schema.properties ?? {})
    .filter(([k]) => k !== "schema_version" && (!only || only.includes(k)) && !exclude?.includes(k));
  if (only) props.sort((a, b) => only.indexOf(a[0]) - only.indexOf(b[0]));
  if (!props.length) return <div className="muted">This tool has no settings.</div>;
  return (
    <div className="form">
      {props.map(([k, s]) => (
        <Field key={k} name={k} schema={s} root={r} value={value[k]} onChange={(v) => onChange({ ...value, [k]: v })} />
      ))}
    </div>
  );
}

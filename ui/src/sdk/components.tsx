// Small shared building blocks so every tool looks the same.

import type { ReactNode } from "react";

export function Stat({ value, unit, caption, tone, big }:
  { value: ReactNode; unit?: string; caption?: ReactNode; tone?: "up" | "down" | "warm" | "accent"; big?: boolean }) {
  return (
    <div className={`stat ${big ? "stat-big" : ""}`}>
      <div className={`stat-value ${tone ? `tone-${tone}` : ""}`}>
        {value}{unit && <span className="stat-unit">{unit}</span>}
      </div>
      {caption !== undefined && <div className="stat-caption">{caption}</div>}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: "up" | "down" | "warm" | "accent" | "muted" }) {
  return <span className={`badge ${tone ? `badge-${tone}` : ""}`}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><div className="empty-title">{title}</div>{children && <div className="empty-body">{children}</div>}</div>;
}

export function Sparkline({ values, width = 120, height = 32, tone }:
  { values: number[]; width?: number; height?: number; tone?: "up" | "down" }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  const t = tone ?? (values[values.length - 1] >= values[0] ? "up" : "down");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`spark spark-${t}`} aria-hidden>
      <polyline points={pts.join(" ")} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Segmented<T extends string>({ value, options, onChange }:
  { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value}
          className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// Shared building blocks so every tool looks the same. Visual rules: docs/DESIGN_SYSTEM.md.

import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./icons";

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

/** Card heading: tool icon + sentence-case title, optional quiet detail on the right. */
export function CardTitle({ icon, children, detail }: { icon?: string; children: ReactNode; detail?: ReactNode }) {
  return (
    <div className="card-title">
      {icon && <Icon name={icon} size={16} />}
      <span className="card-title-text">{children}</span>
      {detail !== undefined && <span className="card-title-detail">{detail}</span>}
    </div>
  );
}

/** One labelled fact with an icon, for compact grids of secondary values. */
export function Fact({ icon, label, value, tone, title }:
  { icon: string; label: string; value: ReactNode; tone?: "up" | "down" | "warm" | "accent"; title?: string }) {
  return (
    <div className="fact" title={title}>
      <Icon name={icon} size={16} className="fact-icon" />
      <span className="fact-label">{label}</span>
      <span className={`fact-value ${tone ? `tone-${tone}` : ""}`}>{value}</span>
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: "up" | "down" | "warm" | "accent" | "muted" }) {
  return <span className={`badge ${tone ? `badge-${tone}` : ""}`}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><div className="empty-title">{title}</div>{children && <div className="empty-body">{children}</div>}</div>;
}

/**
 * A low→high range on a shared scale, painted with a slice of one cool→warm gradient that spans the whole scale,
 * so colours mean the same temperature on every row.
 */
export function RangeBar({ low, high, min, max, marker }: { low: number; high: number; min: number; max: number; marker?: number }) {
  const span = Math.max(max - min, 1);
  const left = ((low - min) / span) * 100;
  const width = Math.max(((high - low) / span) * 100, 3);
  // the fill shows the [left, left+width] slice of a gradient as wide as the whole scale
  const style = { "--l": `${left}%`, "--w": `${width}%`, "--lr": `${(left / width) * 100}%`, "--sw": `${10000 / width}%` } as CSSProperties;
  return (
    <div className="range-bar" style={style} aria-hidden>
      <div className="range-fill" />
      {marker !== undefined && <div className="range-marker" style={{ left: `${((marker - min) / span) * 100}%` }} />}
    </div>
  );
}

/** Small vertical bars (0–100), e.g. hourly chance of rain. */
export function Bars({ values, labels, top, height = 36, highlight = 40 }:
  { values: number[]; labels?: ReactNode[]; top?: ReactNode[]; height?: number; highlight?: number }) {
  return (
    <div className="bars" style={{ "--bars-h": `${height}px`, gridTemplateColumns: `repeat(${values.length}, 1fr)` } as CSSProperties}>
      {values.map((v, i) => (
        <div className="bar-col" key={i}>
          {top && <div className="bar-top">{top[i]}</div>}
          <div className="bar-track"><div className={`bar-fill ${v >= highlight ? "hot" : ""}`} style={{ height: `${Math.max(v, 2)}%` }} /></div>
          {labels && <div className="bar-label">{labels[i]}</div>}
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 32, tone, fill }:
  { values: number[]; width?: number; height?: number; tone?: "up" | "down"; fill?: boolean }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [((i / (values.length - 1)) * (width - 2) + 1), (height - 3 - ((v - min) / span) * (height - 6))]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const t = tone ?? (values[values.length - 1] >= values[0] ? "up" : "down");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`spark spark-${t}`} aria-hidden>
      {fill && <polygon points={`1,${height} ${line} ${width - 1},${height}`} className="spark-area" />}
      <polyline points={line} fill="none" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
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

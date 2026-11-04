// Wraps every card: loading skeleton, error, disabled and stale states, plus an error boundary so one
// broken card never breaks the page. Cards themselves only render the happy path.

import { Component, type ReactNode } from "react";
import { api } from "../core/api";
import { findCard } from "../core/registry";
import { useStore } from "../core/store";
import type { Size } from "../core/types";
import { Icon } from "../sdk/icons";

class Boundary extends Component<{ children: ReactNode }, { err: string }> {
  state = { err: "" };
  static getDerivedStateFromError(e: Error) { return { err: e.message || "This card crashed" }; }
  render() { return this.state.err ? <div className="card-state error"><Icon name="alert" /> {this.state.err}</div> : this.props.children; }
}

function ago(ts: number): string {
  const m = Math.round((Date.now() / 1000 - ts) / 60);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export function CardHost({ cardRef, size, onOpen }: { cardRef: string; size: Size; onOpen?: () => void }) {
  const found = findCard(cardRef);
  const tool = cardRef.split("/")[0];
  const entry = useStore((s) => s.state[tool]);
  const info = useStore((s) => s.tools[tool]);
  const title = info?.manifest.cards.find((c) => `${tool}/${c.id}` === cardRef)?.name ?? cardRef;

  let body: ReactNode;
  if (!found) body = <div className="card-state">This card is no longer available</div>;
  else if (!entry || (entry.status === "loading" && !entry.data)) body = <div className="skeleton" />;
  else if (entry.status === "disabled") body = <div className="card-state"><Icon name="shield" /> {entry.error}</div>;
  else if (!entry.data) body = (
    <div className="card-state error">
      <Icon name="alert" /> {entry.error || "No data yet"}
      <button className="link" onClick={() => api.refresh(tool)}>Retry</button>
    </div>
  );
  else {
    const C = found.card.render;
    const stale = entry.status === "error" ||
      (entry.updated_at && entry.interval && Date.now() / 1000 - entry.updated_at > entry.interval * 3);
    body = (
      <div className={stale ? "is-stale" : ""}>
        <Boundary><C size={size} /></Boundary>
        {stale && <div className="stale-note" title={entry.error}>Updated {ago(entry.updated_at ?? 0)}{entry.error ? " · retrying" : ""}</div>}
      </div>
    );
  }
  return (
    <section className={`card size-${size}`} aria-label={title}>
      {onOpen && <button className="card-open" onClick={onOpen} aria-label={`Open ${info?.manifest.name ?? tool}`} title={`Open ${info?.manifest.name ?? tool}`} />}
      {body}
    </section>
  );
}

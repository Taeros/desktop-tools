import { callAction, CardTitle, defineCard, defineTool, fmtNum, fmtPct, Icon, Sparkline, useProvider, useState, type CardProps } from "@sdk";

// Mirrors MarketsState in tools/markets/provider.py
interface Q { symbol: string; name: string; currency: string; price: number | null; changes: Record<string, number | null>; spark: number[]; error: string }
interface M { quotes: Q[] }

const PERIODS = ["1D", "1W", "1M", "1Y"] as const;
const tone = (v: number | null | undefined) => (v === null || v === undefined ? "" : v >= 0 ? "up" : "down");
const shortName = (n: string) => n.replace(/ (Index )?(Fund )?ETF$/i, "").replace(/^Vanguard /, "Vanguard ");

function Change({ v, digits = 1, big }: { v: number | null | undefined; digits?: number; big?: boolean }) {
  const t = tone(v);
  return (
    <span className={`mk-change ${t ? `tone-${t}` : "muted"} ${big ? "big" : ""}`}>
      {t && <Icon name={t === "up" ? "trend-up" : "trend-down"} size={big ? 18 : 13} />}{fmtPct(v, digits)}
    </span>
  );
}

function Periods({ q }: { q: Q }) {
  return (
    <div className="mk-periods">
      {PERIODS.map((p) => (
        <div key={p} className="mk-period"><span className="muted">{p}</span><Change v={q.changes[p]} digits={p === "1D" ? 2 : 1} /></div>
      ))}
    </div>
  );
}

function Watchlist({ size }: CardProps) {
  const m = useProvider<M>("markets");
  if (!m.quotes.length) return <div className="muted">Add a ticker on the Markets page</div>;
  if (size === "S") {
    const q = m.quotes[0];
    return (
      <div className="mk-s">
        <CardTitle icon="chart-line" detail={q.price !== null ? fmtNum(q.price, 2) : undefined}>{q.symbol}</CardTitle>
        <div className="mk-s-row"><Change v={q.changes["1D"]} digits={2} big /><Sparkline values={q.spark.slice(-22)} width={90} height={30} fill /></div>
        <div className="mk-s-sub"><span className="muted">1Y</span> <Change v={q.changes["1Y"]} /></div>
      </div>
    );
  }
  const rows = m.quotes.slice(0, size === "M" ? 1 : 3);
  return (
    <div className={`mk-list mk-${size}`}>
      <CardTitle icon="chart-line" detail={m.quotes.length > rows.length ? `+${m.quotes.length - rows.length} more` : undefined}>Markets</CardTitle>
      {rows.map((q) => (
        <div key={q.symbol} className="mk-item">
          <div className="mk-id">
            <div className="mk-sym">{q.symbol}</div>
            <div className="muted ellipsis small">{q.error || shortName(q.name)}</div>
          </div>
          <div className="mk-price">{q.price !== null ? <>{fmtNum(q.price, 2)}<span className="muted small"> {q.currency}</span></> : "--"}</div>
          <Sparkline values={q.spark} width={size === "M" ? 110 : 120} height={34} fill />
          <Periods q={q} />
        </div>
      ))}
    </div>
  );
}

function Page() {
  const m = useProvider<M | undefined>("markets");
  const [sym, setSym] = useState("");
  const add = async () => { if (sym.trim()) { await callAction("markets", "add_ticker", { symbol: sym }).catch(() => undefined); setSym(""); } };
  return (
    <div className="tool-page">
      <div className="toolbar">
        <div className="search small">
          <Icon name="plus" />
          <input value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} placeholder="Add a ticker, like VTI" aria-label="Add ticker"
            onKeyDown={(e) => e.key === "Enter" && add()} />
        </div>
      </div>
      {!m ? <div className="skeleton tall" /> : (
        <div className="mk-grid">
          {m.quotes.map((q) => (
            <section className="panel mk-tile" key={q.symbol}>
              <div className="mk-tile-head">
                <div><div className="mk-sym big">{q.symbol}</div><div className="muted small ellipsis">{q.error || q.name}</div></div>
                <div className="mk-tile-price">{q.price !== null ? fmtNum(q.price, 2) : "--"}<span className="muted small"> {q.currency}</span></div>
                <button className="icon-btn" onClick={() => callAction("markets", "remove_ticker", { symbol: q.symbol })}
                  aria-label={`Remove ${q.symbol}`} title="Remove from watchlist"><Icon name="x" /></button>
              </div>
              <Sparkline values={q.spark} width={420} height={80} fill />
              <Periods q={q} />
            </section>
          ))}
        </div>
      )}
      <p className="muted small">Prices from Yahoo Finance and may be delayed. Each change compares the latest price with the close one trading day, one week, one month and one year earlier. The chart covers about three months.</p>
    </div>
  );
}

export default defineTool({ cards: [defineCard({ id: "watchlist", render: Watchlist })], Page });

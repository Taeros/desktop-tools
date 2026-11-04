import { callAction, defineCard, defineTool, fmtNum, fmtPct, Icon, Sparkline, useProvider, useState, type CardProps } from "@sdk";

// Mirrors MarketsState in tools/markets/provider.py
interface Q { symbol: string; name: string; currency: string; price: number | null; changes: Record<string, number | null>; spark: number[]; error: string }
interface M { quotes: Q[] }

const PERIODS = ["1D", "1W", "1M", "1Y"] as const;
const tone = (v: number | null | undefined) => (v === null || v === undefined ? "muted" : v >= 0 ? "tone-up" : "tone-down");

function Watchlist({ size }: CardProps) {
  const m = useProvider<M>("markets");
  if (size === "S") {
    const q = m.quotes[0];
    if (!q) return <div className="muted">Add a ticker in Markets</div>;
    return (
      <div className="mk-s">
        <div className="card-title">{q.symbol}</div>
        <div className={`mk-big ${tone(q.changes["1D"])}`}>{fmtPct(q.changes["1D"])}</div>
        <div className="mk-row">{PERIODS.slice(1).map((p) => <span key={p}><span className="muted">{p}</span> <span className={tone(q.changes[p])}>{fmtPct(q.changes[p], 1)}</span></span>)}</div>
      </div>
    );
  }
  const rows = m.quotes.slice(0, size === "M" ? 3 : 7);
  return (
    <div className="mk-list">
      <table className="table compact mk-table">
        <thead><tr><th>Markets</th>{PERIODS.map((p) => <th key={p} className="num">{p}</th>)}{size !== "M" && <th />}</tr></thead>
        <tbody>
          {rows.map((q) => (
            <tr key={q.symbol}>
              <td className="mk-sym">{q.symbol}</td>
              {q.error ? <td colSpan={4} className="muted">{q.error}</td>
                : PERIODS.map((p) => <td key={p} className={`num ${tone(q.changes[p])}`}>{fmtPct(q.changes[p], p === "1D" ? 2 : 1)}</td>)}
              {size !== "M" && <td><Sparkline values={q.spark} width={90} height={22} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {m.quotes.length > rows.length && <div className="muted small">+{m.quotes.length - rows.length} more</div>}
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
          <input value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} placeholder="Add ticker: VTI" aria-label="Add ticker"
            onKeyDown={(e) => e.key === "Enter" && add()} />
        </div>
      </div>
      {!m ? <div className="skeleton tall" /> : (
        <section className="panel">
          <table className="table mk-table">
            <thead><tr><th>Symbol</th><th>Name</th><th className="num">Price</th>{PERIODS.map((p) => <th key={p} className="num">{p}</th>)}<th>3 months</th><th /></tr></thead>
            <tbody>
              {m.quotes.map((q) => (
                <tr key={q.symbol}>
                  <td className="mk-sym">{q.symbol}</td>
                  <td className="muted ellipsis">{q.error || q.name}</td>
                  <td className="num">{q.price !== null ? `${fmtNum(q.price, 2)} ${q.currency}` : "--"}</td>
                  {PERIODS.map((p) => <td key={p} className={`num ${tone(q.changes[p])}`}>{fmtPct(q.changes[p])}</td>)}
                  <td><Sparkline values={q.spark} width={140} height={28} /></td>
                  <td><button className="icon-btn" onClick={() => callAction("markets", "remove_ticker", { symbol: q.symbol })}
                    aria-label={`Remove ${q.symbol}`} title="Remove"><Icon name="x" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <div className="muted small">Prices from Yahoo Finance, may be delayed. Percent change compares the latest price with the close 1 trading day, 1 week, 1 month and 1 year earlier.</div>
    </div>
  );
}

export default defineTool({ cards: [defineCard({ id: "watchlist", render: Watchlist })], Page });

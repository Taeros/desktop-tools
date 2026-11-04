import { callAction, defineCard, defineTool, fmtDate, fmtHM, Icon, useProvider, useTick, useToolSettings, type CardProps } from "@sdk";

// Mirrors ClocksState in tools/clocks/provider.py
interface Z { id: string; name: string; region: string; tz: string; offset_min: number; abbr: string; hidden: boolean }
interface C { local_tz: string; local_offset_min: number; zones: Z[] }

/** Wall-clock parts at a UTC offset, computed from the current instant (no reliance on the PC's zone rules). */
function at(now: number, offsetMin: number) {
  const d = new Date(now + offsetMin * 60000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), day: Math.floor((now + offsetMin * 60000) / 86400000) };
}
const utc = (off: number) => `UTC${off < 0 ? "−" : "+"}${Math.floor(Math.abs(off) / 60)}${Math.abs(off) % 60 ? `:${String(Math.abs(off) % 60).padStart(2, "0")}` : ""}`;

function World({ size }: CardProps) {
  const c = useProvider<C>("clocks");
  const s = useToolSettings<{ show_seconds: boolean }>("clocks");
  const now = useTick(1000);
  const here = at(now, c.local_offset_min);
  const zones = c.zones.filter((z) => !z.hidden).slice(0, size === "S" ? 0 : size === "M" ? 4 : 10);
  return (
    <div className={`clk clk-${size}`}>
      <div className="clk-local">
        <div className="card-title">Local time</div>
        <div className="clk-big">{fmtHM(here.h, here.m, s?.show_seconds ? { seconds: here.s } : {})}</div>
        <div className="muted">{fmtDate(new Date(now))}</div>
      </div>
      {zones.length > 0 && (
        <div className="clk-zones">
          {zones.map((z) => {
            const t = at(now, z.offset_min);
            const diff = t.day - here.day;
            return (
              <div key={z.id} className="clk-zone" title={`${z.tz} · ${utc(z.offset_min)}`}>
                <span className="muted ellipsis">{z.name}</span>
                <span className="num">{fmtHM(t.h, t.m)}{diff !== 0 && <sup className="tone-warm">{diff > 0 ? "+1" : "−1"}</sup>}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Page() {
  const c = useProvider<C | undefined>("clocks");
  const now = useTick(1000);
  if (!c) return <div className="skeleton tall" />;
  const here = at(now, c.local_offset_min);
  return (
    <div className="tool-page">
      <section className="panel clk-hero">
        <div className="clk-huge">{fmtHM(here.h, here.m, { seconds: here.s })}</div>
        <div className="muted">{fmtDate(new Date(now))} · {c.local_tz} · {utc(c.local_offset_min)}</div>
      </section>
      <section className="panel">
        <div className="card-title">Saved places <span className="muted">click the eye to show or hide on the clock card</span></div>
        <div className="clk-grid">
          {c.zones.map((z) => {
            const t = at(now, z.offset_min);
            const diff = t.day - here.day;
            const rel = z.offset_min - c.local_offset_min;
            return (
              <div key={z.id} className={`clk-tile ${z.hidden ? "is-hidden" : ""}`}>
                <div className="clk-tile-head">
                  <span>{z.name}<span className="muted">{z.region ? `, ${z.region}` : ""}</span></span>
                  <button className="icon-btn" onClick={() => callAction("clocks", "toggle", { location_id: z.id })}
                    aria-label={z.hidden ? `Show ${z.name}` : `Hide ${z.name}`} title={z.hidden ? "Hidden on the card" : "Shown on the card"}>
                    <Icon name={z.hidden ? "eye-off" : "eye"} /></button>
                </div>
                <div className="clk-mid">{fmtHM(t.h, t.m)}{diff !== 0 && <sup className="tone-warm">{diff > 0 ? "+1" : "−1"}</sup>}</div>
                <div className="muted small">{/^[A-Za-z]/.test(z.abbr) ? `${z.abbr} · ` : ""}{utc(z.offset_min)} · {rel === 0 ? "same as local" : `${rel > 0 ? "+" : "−"}${Math.abs(rel) / 60} h`}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default defineTool({ cards: [defineCard({ id: "world", render: World })], Page });

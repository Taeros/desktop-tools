import { callAction, CardTitle, defineCard, defineTool, fmtDate, fmtHM, Icon, useProvider, useTick, useToolSettings, type CardProps } from "@sdk";

// Mirrors ClocksState in tools/clocks/provider.py
interface Z { id: string; name: string; region: string; tz: string; offset_min: number; abbr: string; hidden: boolean }
interface C { local_tz: string; local_offset_min: number; zones: Z[] }

/** Wall-clock parts at a UTC offset, computed from the current instant. */
function at(now: number, offsetMin: number) {
  const ms = now + offsetMin * 60000;
  const d = new Date(ms);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), day: Math.floor(ms / 86400000) };
}
const utc = (off: number) => `UTC${off < 0 ? "−" : "+"}${Math.floor(Math.abs(off) / 60)}${Math.abs(off) % 60 ? `:${String(Math.abs(off) % 60).padStart(2, "0")}` : ""}`;
const rel = (off: number) => (off === 0 ? "Same time" : `${off > 0 ? "+" : "−"}${Math.abs(off) / 60} h`);
const isNight = (h: number) => h < 6 || h >= 19;

function ZoneRow({ z, now, here }: { z: Z; now: number; here: ReturnType<typeof at> }) {
  const t = at(now, z.offset_min);
  const diff = t.day - here.day;
  return (
    <div className="clk-zone" title={`${z.tz}, ${utc(z.offset_min)}`}>
      <Icon name={isNight(t.h) ? "moon" : "sun"} size={15} className={isNight(t.h) ? "clk-night" : "clk-day"} />
      <span className="clk-zone-name ellipsis">{z.name}</span>
      <span className="clk-zone-rel muted">{diff !== 0 ? (diff > 0 ? "Tomorrow" : "Yesterday") : ""}</span>
      <span className="clk-zone-time">{fmtHM(t.h, t.m)}</span>
    </div>
  );
}

function World({ size }: CardProps) {
  const c = useProvider<C>("clocks");
  const s = useToolSettings<{ show_seconds: boolean }>("clocks");
  const now = useTick(1000);
  const here = at(now, c.local_offset_min);
  const zones = c.zones.filter((z) => !z.hidden).slice(0, size === "S" ? 0 : size === "M" ? 3 : 7);
  return (
    <div className={`clk clk-${size}`}>
      <div className="clk-local">
        <CardTitle icon="clock">Local time</CardTitle>
        <div className="clk-big">{fmtHM(here.h, here.m)}{s?.show_seconds && <span className="clk-sec">{String(here.s).padStart(2, "0")}</span>}</div>
        <div className="muted">{fmtDate(new Date(now))}</div>
      </div>
      {zones.length > 0 && <div className="clk-zones">{zones.map((z) => <ZoneRow key={z.id} z={z} now={now} here={here} />)}</div>}
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
        <div className="clk-huge">{fmtHM(here.h, here.m)}<span className="clk-sec">{String(here.s).padStart(2, "0")}</span></div>
        <div className="muted">{fmtDate(new Date(now))}, {c.local_tz} ({utc(c.local_offset_min)})</div>
      </section>
      <div className="clk-grid">
        {c.zones.map((z) => {
          const t = at(now, z.offset_min);
          const diff = t.day - here.day;
          const night = isNight(t.h);
          return (
            <section key={z.id} className={`panel clk-tile ${night ? "is-night" : "is-day"} ${z.hidden ? "is-hidden" : ""}`}>
              <div className="clk-tile-head">
                <Icon name={night ? "moon" : "sun"} size={18} className={night ? "clk-night" : "clk-day"} />
                <span className="clk-tile-name">{z.name}<span className="muted">{z.region ? `, ${z.region}` : ""}</span></span>
                <button className="icon-btn" onClick={() => callAction("clocks", "toggle", { location_id: z.id })}
                  aria-label={z.hidden ? `Show ${z.name} on the clock card` : `Hide ${z.name} from the clock card`}
                  title={z.hidden ? "Hidden from the clock card" : "Shown on the clock card"}>
                  <Icon name={z.hidden ? "eye-off" : "eye"} /></button>
              </div>
              <div className="clk-mid">{fmtHM(t.h, t.m)}</div>
              <div className="muted small">
                {diff !== 0 ? `${diff > 0 ? "Tomorrow" : "Yesterday"}, ` : ""}{rel(z.offset_min - c.local_offset_min)}
                {/^[A-Za-z]/.test(z.abbr) ? `, ${z.abbr}` : ""} ({utc(z.offset_min)})
              </div>
            </section>
          );
        })}
      </div>
      <p className="muted small">Add or remove places in Settings → Saved places. The eye controls whether a place appears on the clock card.</p>
    </div>
  );
}

export default defineTool({ cards: [defineCard({ id: "world", render: World })], Page });

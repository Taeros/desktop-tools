import {
  defineCard, defineTool, fmtDow, fmtIsoTime, fmtNum, fmtTemp, Icon, saveToolSettings, useApp, useProvider,
  useToolSettings, type CardProps,
} from "@sdk";

// Mirrors WeatherState in tools/weather/provider.py
interface W {
  place: { name: string; region: string; is_me: boolean };
  now: { temp: number; feels: number; condition: string; icon: string; is_day: boolean; wind: number; gust: number; humidity: number; uv: number | null };
  today: { high: number; low: number; uv_now_level: string; uv_max_level: string; sunrise: string; sunset: string };
  outlook: { kind: string | null; label: string; start: string | null; end: string | null; max_pop: number; freezing: boolean; gust_warning: number | null };
  night: { percent: number; moon_percent: number; phase: string; cloud_percent: number };
  days: { date: string; high: number; low: number; pop: number; icon: string; condition: string }[];
  hours: { time: string; temp: number; pop: number; icon: string }[];
  units: { temp: string; wind: string };
}

const icon = (name: string, isDay = true) => (!isDay && name === "sun" ? "moon" : !isDay && name === "cloud-sun" ? "cloud" : name);
const popTone = (p: number) => (p >= 40 ? "tone-accent" : p >= 15 ? "" : "muted");

function outlookText(o: W["outlook"]): string {
  let s = o.label;
  if (o.kind && o.start) s += o.end ? ` ${fmtIsoTime(o.start)}–${fmtIsoTime(o.end)}` : ` from ${fmtIsoTime(o.start)}`;
  if (o.kind) s += ` (${fmtNum(o.max_pop)}%)`;
  const extra = [o.freezing && "freezing", o.gust_warning && `gusts ${fmtNum(o.gust_warning)}`].filter(Boolean);
  return extra.length ? `${s} · ${extra.join(" · ")}` : s;
}

function Now({ size }: CardProps) {
  const w = useProvider<W>("weather");
  const n = w.now, t = w.today;
  return (
    <div className={`wx-now wx-${size}`}>
      <div className="card-title">{w.place.is_me ? "My location" : w.place.name}{w.place.region ? `, ${w.place.region}` : ""}</div>
      <div className="wx-main">
        <div className="wx-temp">{fmtTemp(n.temp)}</div>
        <div className="wx-cond">
          <div className="wx-cond-line"><Icon name={icon(n.icon, n.is_day)} size={18} /> {n.condition}</div>
          <div className="muted">Feels {fmtTemp(n.feels)} · H {fmtTemp(t.high)} · L {fmtTemp(t.low)}</div>
        </div>
        {size !== "S" && (
          <div className="wx-facts">
            <div><Icon name="sunrise" size={15} /> {fmtIsoTime(t.sunrise)} <Icon name="sunset" size={15} /> {fmtIsoTime(t.sunset)}</div>
            <div title="UV now / today's peak">UV {t.uv_now_level} / {t.uv_max_level}</div>
            <div title={`${w.night.phase}, ${w.night.moon_percent}% lit, ${w.night.cloud_percent}% cloud cover tonight`}>
              <Icon name="moon" size={15} /> Night light {fmtNum(w.night.percent)}%</div>
          </div>
        )}
      </div>
      {size !== "S" && <div className={`wx-outlook ${w.outlook.kind ? "tone-accent" : "muted"}`}>{outlookText(w.outlook)}</div>}
      {size === "L" && <HourStrip hours={w.hours.slice(0, 12)} />}
    </div>
  );
}

function HourStrip({ hours }: { hours: W["hours"] }) {
  return (
    <div className="wx-hours">
      {hours.map((h, i) => (
        <div key={h.time} className="wx-hour">
          <div className="muted">{i === 0 ? "Now" : fmtIsoTime(h.time, true)}</div>
          <div>{fmtTemp(h.temp)}</div>
          <div className={popTone(h.pop)}>{fmtNum(h.pop)}%</div>
        </div>
      ))}
    </div>
  );
}

function Week({ size }: CardProps) {
  const w = useProvider<W>("weather");
  return (
    <div className={`wx-week wx-${size}`}>
      <div className="card-title">7 days <span className="muted">high · low · rain</span></div>
      <div className="wx-days">
        {w.days.map((d, i) => (
          <div key={d.date} className="wx-day" title={d.condition}>
            <div className="muted">{i === 0 ? "Today" : fmtDow(d.date)}</div>
            {size === "L" && <Icon name={d.icon} size={18} />}
            <div className="wx-hi">{fmtTemp(d.high)}</div>
            <div className="muted">{fmtTemp(d.low)}</div>
            <div className={popTone(d.pop)}>{fmtNum(d.pop)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Page() {
  const w = useProvider<W | undefined>("weather");
  const app = useApp();
  const settings = useToolSettings<{ location_id: string }>("weather");
  const selected = settings?.location_id || app.locations[0]?.id || "";
  return (
    <div className="tool-page">
      <div className="toolbar">
        <div className="chips" role="radiogroup" aria-label="Location">
          {app.locations.map((l) => (
            <button key={l.id} role="radio" aria-checked={selected === l.id} className={`chip ${selected === l.id ? "on" : ""}`}
              onClick={() => saveToolSettings("weather", { location_id: l.id })}>{l.name}</button>
          ))}
          {app.use_my_location && (
            <button role="radio" aria-checked={selected === "@me"} className={`chip ${selected === "@me" ? "on" : ""}`}
              onClick={() => saveToolSettings("weather", { location_id: "@me" })}><Icon name="locate" size={14} /> My location</button>
          )}
        </div>
      </div>
      {!w ? <div className="skeleton tall" /> : (<>
        <section className="panel"><Now size="M" /></section>
        <section className="panel">
          <div className="card-title">Next 24 hours</div>
          <table className="table compact wx-table">
            <tbody>
              <tr><th>Time</th>{w.hours.map((h, i) => <td key={h.time} className="muted">{i === 0 ? "Now" : fmtIsoTime(h.time, true)}</td>)}</tr>
              <tr><th>Temp</th>{w.hours.map((h) => <td key={h.time}>{fmtTemp(h.temp)}</td>)}</tr>
              <tr><th>Rain</th>{w.hours.map((h) => <td key={h.time} className={popTone(h.pop)}>{fmtNum(h.pop)}%</td>)}</tr>
            </tbody>
          </table>
        </section>
        <section className="panel"><Week size="L" /></section>
        <div className="muted small">Wind {fmtNum(w.now.wind)} {w.units.wind}, gusts {fmtNum(w.now.gust)} · humidity {fmtNum(w.now.humidity)}% · data: Open-Meteo</div>
      </>)}
    </div>
  );
}

export default defineTool({
  cards: [defineCard({ id: "now", render: Now }), defineCard({ id: "week", render: Week })],
  Page,
});

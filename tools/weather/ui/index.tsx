import {
  Bars, CardTitle, defineCard, defineTool, Fact, fmtDow, fmtIsoTime, fmtNum, fmtTemp, Icon, RangeBar,
  saveToolSettings, useApp, useProvider, useToolSettings, type CardProps,
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

const dayIcon = (name: string, isDay = true) => (!isDay && name === "sun" ? "moon" : !isDay && name === "cloud-sun" ? "cloud" : name);
/** Icon colour follows the condition: sun warm, moon pale, rain and storms blue, snow cool, cloud and fog grey. */
const TONE: Record<string, string> = { sun: "wx-tone-sun", moon: "wx-tone-moon", "cloud-sun": "wx-tone-sun", "cloud-rain": "wx-tone-rain",
  "cloud-storm": "wx-tone-rain", snowflake: "wx-tone-snow", cloud: "wx-tone-cloud", mist: "wx-tone-cloud" };
function WxIcon({ name, isDay = true, size }: { name: string; isDay?: boolean; size: number }) {
  const n = dayIcon(name, isDay);
  return <Icon name={n} size={size} className={`wx-icon ${TONE[n] ?? "wx-tone-cloud"}`} />;
}
const placeName = (w: W) => (w.place.is_me ? "My location" : `${w.place.name}${w.place.region ? `, ${w.place.region}` : ""}`);
const UV_SHORT: Record<string, string> = { Low: "Low", Moderate: "Moderate", High: "High", "Very high": "Very high", Extreme: "Extreme" };

function outlookText(o: W["outlook"]): string {
  let s = o.label;
  if (o.kind && o.start) s += o.end ? ` ${fmtIsoTime(o.start)}–${fmtIsoTime(o.end)}` : ` from ${fmtIsoTime(o.start)}`;
  if (o.kind) s += `, up to ${fmtNum(o.max_pop)}%`;
  return s;
}

function Outlook({ o }: { o: W["outlook"] }) {
  const warn = [o.freezing && "Freezing temperatures", o.gust_warning && `Gusts to ${fmtNum(o.gust_warning)}`].filter(Boolean) as string[];
  return (
    <div className={`wx-outlook ${o.kind ? "is-wet" : ""}`}>
      <Icon name={o.kind ? "umbrella" : "sun"} size={16} />
      <span>{outlookText(o)}</span>
      {warn.map((w) => <span key={w} className="wx-warn"><Icon name="alert" size={14} /> {w}</span>)}
    </div>
  );
}

function Now({ size }: CardProps) {
  const w = useProvider<W>("weather");
  const n = w.now, t = w.today;
  if (size === "S") {
    return (
      <div className="wx-now wx-S">
        <CardTitle icon="map-pin">{placeName(w)}</CardTitle>
        <div className="wx-hero">
          <WxIcon name={n.icon} isDay={n.is_day} size={34} />
          <div className="wx-temp">{fmtTemp(n.temp)}</div>
          <div className="wx-cond"><div className="wx-cond-name">{n.condition}</div><div className="muted">H {fmtTemp(t.high)}  L {fmtTemp(t.low)}</div></div>
        </div>
      </div>
    );
  }
  return (
    <div className={`wx-now wx-${size}`}>
      <CardTitle icon="map-pin">{placeName(w)}</CardTitle>
      <div className="wx-body">
        <div className="wx-hero">
          <WxIcon name={n.icon} isDay={n.is_day} size={44} />
          <div className="wx-temp">{fmtTemp(n.temp)}</div>
          <div className="wx-cond">
            <div className="wx-cond-name">{n.condition}</div>
            <div className="muted">Feels like {fmtTemp(n.feels)}</div>
            <div className="wx-hilo"><span><Icon name="arrow-up" size={13} />{fmtTemp(t.high)}</span><span><Icon name="arrow-down" size={13} />{fmtTemp(t.low)}</span></div>
          </div>
        </div>
        <div className="facts">
          <Fact icon="sunrise" label="Sunrise" value={fmtIsoTime(t.sunrise)} />
          <Fact icon="sunset" label="Sunset" value={fmtIsoTime(t.sunset)} />
          <Fact icon="uv" label="UV now" value={UV_SHORT[t.uv_now_level] ?? t.uv_now_level} title={`Today's peak: ${t.uv_max_level}`} />
          <Fact icon="moon" label="Night light" value={`${fmtNum(w.night.percent)}%`}
            title={`${w.night.phase}, ${w.night.moon_percent}% lit, ${w.night.cloud_percent}% cloud cover tonight`} />
          {size === "L" && <Fact icon="wind" label="Wind" value={`${fmtNum(n.wind)} ${w.units.wind}`} title={`Gusts ${fmtNum(n.gust)} ${w.units.wind}`} />}
          {size === "L" && <Fact icon="droplet" label="Humidity" value={`${fmtNum(n.humidity)}%`} />}
        </div>
      </div>
      <Outlook o={w.outlook} />
      {size === "L" && <RainStrip hours={w.hours.slice(0, 12)} />}
    </div>
  );
}

function RainStrip({ hours, height = 34 }: { hours: W["hours"]; height?: number }) {
  return (
    <div className="wx-strip">
      <div className="wx-strip-head"><span>Next {hours.length} hours</span><span className="muted">temperature and chance of rain</span></div>
      <Bars values={hours.map((h) => h.pop)} height={height}
        top={hours.map((h) => fmtTemp(h.temp))}
        labels={hours.map((h, i) => (
          <span key={h.time} title={`${fmtNum(h.pop)}% chance of rain`}>
            <span className={`bar-pop ${h.pop >= 40 ? "is-wet" : ""}`}>{h.pop >= 10 ? `${fmtNum(h.pop)}%` : "\u00a0"}</span>
            <span>{i === 0 ? "Now" : fmtIsoTime(h.time, true)}</span>
          </span>
        ))} />
    </div>
  );
}

function Week({ size }: CardProps) {
  const w = useProvider<W>("weather");
  const min = Math.min(...w.days.map((d) => d.low)), max = Math.max(...w.days.map((d) => d.high));
  if (size === "M") {
    return (
      <div className="wx-week wx-M">
        <CardTitle icon="calendar" detail="High, low, chance of rain">7 days</CardTitle>
        <div className="wx-days">
          {w.days.map((d, i) => (
            <div key={d.date} className="wx-day" title={d.condition}>
              <div className="wx-day-name">{i === 0 ? "Today" : fmtDow(d.date)}</div>
              <WxIcon name={d.icon} size={20} />
              <div className="wx-temps"><span className="wx-hi">{fmtTemp(d.high)}</span><span className="wx-lo">{fmtTemp(d.low)}</span></div>
              <div className={`wx-pop ${d.pop >= 40 ? "is-wet" : ""}`}>{fmtNum(d.pop)}%</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="wx-week wx-L">
      <CardTitle icon="calendar" detail={`${fmtTemp(min)} to ${fmtTemp(max)} this week`}>7 days</CardTitle>
      <div className="wx-rows">
        {w.days.map((d, i) => (
          <div key={d.date} className="wx-row" title={d.condition}>
            <span className="wx-day-name">{i === 0 ? "Today" : fmtDow(d.date)}</span>
            <WxIcon name={d.icon} size={18} />
            <span className={`wx-pop ${d.pop >= 40 ? "is-wet" : ""}`}>{d.pop >= 10 ? <><Icon name="droplet" size={12} />{fmtNum(d.pop)}%</> : ""}</span>
            <span className="wx-lo">{fmtTemp(d.low)}</span>
            <RangeBar low={d.low} high={d.high} min={min} max={max} marker={i === 0 ? w.now.temp : undefined} />
            <span className="wx-hi">{fmtTemp(d.high)}</span>
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
      {!w ? <div className="skeleton tall" /> : (
        <div className="wx-page">
          <section className="panel wx-page-now"><Now size="L" /></section>
          <section className="panel wx-page-week"><Week size="L" /></section>
          <section className="panel wx-page-day">
            <RainStrip hours={w.hours} height={56} />
          </section>
          <p className="muted small">Forecast from Open-Meteo, updated every 15 minutes.</p>
        </div>
      )}
    </div>
  );
}

export default defineTool({
  cards: [defineCard({ id: "now", render: Now }), defineCard({ id: "week", render: Week })],
  Page,
});

import { useEffect, useState } from "react";
import { TOOL_UI } from "../core/registry";
import { useStore } from "../core/store";
import { Icon } from "../sdk/icons";
import { SettingsPage } from "../settings/SettingsPage";
import { Dashboard } from "./Dashboard";
import { useTheme } from "./theme";

const PAGE_KEY = "dt-page";

export function App() {
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const connected = useStore((s) => s.connected);
  const sidebar = useStore((s) => s.layout?.sidebar) ?? [];
  const tools = useStore((s) => s.tools);
  const startPage = useStore((s) => s.app?.start_page) ?? "home";
  const toasts = useStore((s) => s.toasts);
  const fake = useStore((s) => s.boot?.fake);
  const [page, setPage] = useState<string>(() => sessionStorage.getItem(PAGE_KEY) ?? "");
  useTheme();

  useEffect(() => { if (ready && !page) setPage(startPage); }, [ready, page, startPage]);
  useEffect(() => { if (page) sessionStorage.setItem(PAGE_KEY, page); }, [page]);

  if (error) return <div className="fatal"><Icon name="alert" size={28} /><p>{error}</p></div>;
  if (!ready) return <div className="fatal"><div className="spinner" /></div>;

  const visible = sidebar.filter((e) => !e.hidden && (!e.id.startsWith("tool:") || tools[e.id.slice(5)]?.enabled));
  const current = page === "settings" || page.startsWith("settings") ? page
    : sidebar.find((e) => e.id === page) ? page : "home";
  const entry = sidebar.find((e) => e.id === current);

  let content;
  if (current.startsWith("settings")) content = <SettingsPage initial={current.split(":")[1]} onNavigate={setPage} />;
  else if (current.startsWith("tool:")) {
    const id = current.slice(5);
    const Page = TOOL_UI[id]?.Page;
    content = Page ? <div className="page"><header className="page-head"><h1>{entry?.title}</h1></header><Page /></div>
      : <div className="page"><div className="empty big"><div className="empty-title">This tool has no page</div></div></div>;
  } else content = <Dashboard id={current === "home" ? "home" : current.slice(5)} title={entry?.title ?? "Home"} onNavigate={setPage} />;

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Pages">
        {visible.map((e) => (
          <button key={e.id} className={`nav ${current === e.id ? "on" : ""}`} onClick={() => setPage(e.id)}
            aria-label={e.title} aria-current={current === e.id ? "page" : undefined} data-tip={e.title}>
            <Icon name={e.icon} size={20} />
          </button>
        ))}
        <div className="nav-spacer" />
        {!connected && <div className="nav-warn" data-tip="Reconnecting to the engine…"><Icon name="alert" size={18} /></div>}
        {fake && <div className="nav-fake" data-tip="Fake mode: sample data">F</div>}
        <button className={`nav ${current.startsWith("settings") ? "on" : ""}`} onClick={() => setPage("settings")}
          aria-label="Settings" data-tip="Settings"><Icon name="settings" size={20} /></button>
      </nav>
      <main className="main">{content}</main>
      <div className="toasts" role="status">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </div>
  );
}

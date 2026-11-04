// Screenshots of every page in fake mode (light and dark), for review and visual regression.
// Usage: node scripts/shots.mjs [outDir]   (starts the engine itself with --fake --no-window)
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
// playwright is resolved from the dev machine (globally installed or via NODE_PATH), not a project dependency
const { chromium } = createRequire(import.meta.url)("playwright");

const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });
const port = 47000 + Math.floor(Math.random() * 1000);
const token = "screenshot-token";
const dataDir = join(tmpdir(), `dt-shots-${port}`);
rmSync(dataDir, { recursive: true, force: true });

const engine = spawn("uv", ["run", "dt", "--fake", "--no-window", "--port", String(port), "--token", token, "--data-dir", dataDir],
  { cwd: new URL("../..", import.meta.url).pathname, stdio: ["ignore", "pipe", "pipe"] });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("engine did not start")), 30000);
  const onData = (d) => { if (String(d).includes("Open in a browser")) { clearTimeout(t); res(); } };
  engine.stdout.on("data", onData); engine.stderr.on("data", onData);
});

const api = (method, path, body) => fetch(`http://127.0.0.1:${port}/api${path}`, { method,
  headers: { "X-DT-Token": token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
await api("PUT", "/tools/markets/settings", { tickers: ["VT", "VTI", "BTC-USD"] });
await new Promise((r) => setTimeout(r, 800));
// a "Sizes" dashboard showing every card at its smaller sizes
const layout = (await api("GET", "/bootstrap")).layout;
const small = [["weather/now", "S", 0, 0], ["markets/watchlist", "S", 3, 0], ["weather/now", "M", 6, 0],
  ["clocks/world", "M", 0, 1], ["markets/watchlist", "M", 6, 1], ["weather/week", "M", 0, 2], ["clocks/world", "S", 6, 2]]
  .map(([card, size, x, y], i) => ({ i: `s${i}`, card, size, x, y }));
await api("PUT", "/layout", { ...layout, sidebar: [...layout.sidebar, { id: "dash:sizes", title: "Sizes", icon: "dashboard", hidden: false }],
  dashboards: { ...layout.dashboards, sizes: { cards: small } } });
const browser = await chromium.launch();
const pages = [["home", "home"], ["sizes", "dash:sizes"], ["weather", "tool:weather"], ["markets", "tool:markets"], ["clocks", "tool:clocks"],
  ["settings-general", "settings:general"], ["settings-places", "settings:places"], ["settings-appearance", "settings:appearance"],
  ["settings-layout", "settings:layout"], ["settings-tools", "settings:tools"], ["settings-system", "settings:system"]];
try {
  for (const mode of ["dark", "light"]) {
    await fetch(`http://127.0.0.1:${port}/api/settings/app`, { method: "PUT", headers: { "X-DT-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ theme: { mode, accent: mode === "dark" ? "#7EB0DE" : "#2F6FB0", warm: "#F08C46", density: "comfortable", font_scale: 1, radius: 10 } }) });
    for (const [name, page] of pages) {
      if (mode === "light" && !["home", "weather", "settings-general"].includes(name)) continue;
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await p.addInitScript((pg) => sessionStorage.setItem("dt-page", pg), page);
      await p.goto(`http://127.0.0.1:${port}/#token=${token}`);
      await p.waitForSelector(".sidebar");
      await p.waitForTimeout(900);
      await p.screenshot({ path: join(out, `${name}-${mode}.png`) });
      if (name === "home" && mode === "dark") {
        await p.getByRole("button", { name: "Edit" }).click();
        await p.waitForTimeout(300);
        await p.screenshot({ path: join(out, "home-edit-dark.png") });
        await p.getByRole("button", { name: "Add card" }).click();
        await p.waitForTimeout(300);
        await p.screenshot({ path: join(out, "home-addcard-dark.png") });
      }
      if (errors.length) console.log(`ERRORS on ${name}:`, errors);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  engine.kill();
}
console.log(`screenshots in ${out}`);

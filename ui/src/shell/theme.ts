// Applies the user's theme (universal Settings → Appearance) as CSS variables on <html>.
import { useEffect } from "react";
import { useStore } from "../core/store";

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [126, 176, 222];
}

export function useTheme() {
  const theme = useStore((s) => s.app?.theme);
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    root.dataset.mode = theme.mode;
    root.dataset.density = theme.density;
    const [r, g, b] = hexToRgb(theme.accent);
    const [wr, wg, wb] = hexToRgb(theme.warm);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
    root.style.setProperty("--warm", theme.warm);
    root.style.setProperty("--warm-rgb", `${wr}, ${wg}, ${wb}`);
    root.style.setProperty("--radius", `${theme.radius}px`);
    root.style.setProperty("--scale", String(theme.font_scale));
  }, [theme]);
}

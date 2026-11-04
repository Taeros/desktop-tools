// Finds every tool's UI (tools/<id>/ui/index.tsx) at build time. Dropping in a folder is enough.
import type { CardDef, ToolUI } from "../sdk";
import type { Size } from "./types";

const modules = import.meta.glob<{ default: ToolUI }>("../../../tools/*/ui/index.tsx", { eager: true });

export const TOOL_UI: Record<string, ToolUI> = {};
for (const [path, mod] of Object.entries(modules)) {
  const id = path.split("/").slice(-3, -2)[0];
  if (mod?.default) TOOL_UI[id] = mod.default;
}

export function findCard(ref: string): { tool: string; card: CardDef } | null {
  const [tool, cardId] = ref.split("/");
  const card = TOOL_UI[tool]?.cards.find((c) => c.id === cardId);
  return card ? { tool, card } : null;
}

export const SIZES: Record<Size, { w: number; h: number; label: string }> = {
  S: { w: 3, h: 1, label: "Small" },
  M: { w: 6, h: 1, label: "Medium" },
  L: { w: 6, h: 2, label: "Large" },
  XL: { w: 12, h: 2, label: "Wide" },
};

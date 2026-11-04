export type Size = "S" | "M" | "L" | "XL";

export interface Location { id: string; name: string; region: string; lat: number; lon: number; tz: string }

export interface Theme {
  mode: "dark" | "light"; accent: string; warm: string; density: "comfortable" | "compact";
  font_scale: number; radius: number;
}

export interface AppSettings {
  hotkey: string; start_at_login: boolean; start_page: string;
  units: "metric" | "imperial"; time_format: "24h" | "12h"; date_style: "day-month" | "month-day";
  first_day: "monday" | "sunday"; locations: Location[]; use_my_location: boolean; theme: Theme;
  tools: Record<string, { enabled: boolean; approved: string }>;
}

export interface CardSpec { id: string; name: string; sizes: Size[]; surfaces: string[] }

export interface Manifest {
  id: string; name: string; version: string; description: string; icon: string; category: string;
  page: boolean; cards: CardSpec[]; permissions: { network: string[]; system: string[]; secrets: string[] };
}

export interface ToolInfo {
  manifest: Manifest; enabled: boolean; approved: boolean; error: string;
  settings: Record<string, any> | null; settings_schema: JsonSchema | null; actions: string[];
  secrets: Record<string, boolean>;
}

export interface Entry {
  status: "loading" | "ok" | "error" | "disabled"; error: string; data?: any;
  updated_at?: number; interval: number; failed_at?: number;
}

export interface CardPlacement { i: string; card: string; size: Size; x: number; y: number }
export interface SidebarEntry { id: string; title: string; icon: string; hidden: boolean }
export interface Layout {
  schema_version: number; sidebar: SidebarEntry[]; dashboards: Record<string, { cards: CardPlacement[] }>;
}

export interface Bootstrap {
  version: string; fake: boolean; app: AppSettings; app_schema: JsonSchema; layout: Layout;
  tools: ToolInfo[]; state: Record<string, Entry>; data_dir: string;
  shell: { hotkey?: "active" | "conflict" | "invalid"; hotkey_text?: string };
}

export interface JsonSchema {
  type?: string; title?: string; description?: string; properties?: Record<string, JsonSchema>;
  enum?: unknown[]; const?: unknown; default?: unknown; format?: string; minimum?: number; maximum?: number;
  items?: JsonSchema; anyOf?: JsonSchema[]; $ref?: string; $defs?: Record<string, JsonSchema>;
  step?: number; "x-widget"?: string; "x-allow-me"?: boolean; "x-uppercase"?: boolean;
}

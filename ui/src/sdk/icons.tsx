// The one icon set (Tabler outline). Only the icons listed here are bundled; add names as tools need them.
import {
  IconHome, IconCloud, IconCloudRain, IconCloudStorm, IconHaze, IconSun, IconSnowflake, IconMist, IconMoon,
  IconChartLine, IconClock, IconSettings, IconMapPin, IconBox, IconLayoutDashboard, IconPlus, IconX, IconCheck,
  IconPencil, IconRefresh, IconTrash, IconEye, IconEyeOff, IconChevronUp, IconChevronDown, IconSearch,
  IconCurrentLocation, IconDownload, IconUpload, IconAlertTriangle, IconShieldLock, IconInfoCircle, IconGripVertical,
  IconStar, IconBolt, IconCalendar, IconWorld, IconNotes, IconHeart, IconBriefcase, IconSchool, IconArrowUp,
  IconArrowDown, IconSunrise, IconSunset, IconUmbrella, IconWind, IconTemperature, IconPalette, IconKeyboard,
  IconLayoutSidebar, IconTools, IconDatabase, IconActivity, IconDroplet,
} from "@tabler/icons-react";
import type { Icon as TablerIcon } from "@tabler/icons-react";

export const ICONS: Record<string, TablerIcon> = {
  home: IconHome, cloud: IconCloud, "cloud-rain": IconCloudRain, "cloud-storm": IconCloudStorm,
  "cloud-sun": IconHaze, sun: IconSun, snowflake: IconSnowflake, mist: IconMist, moon: IconMoon,
  "chart-line": IconChartLine, clock: IconClock, settings: IconSettings, "map-pin": IconMapPin, box: IconBox,
  dashboard: IconLayoutDashboard, plus: IconPlus, x: IconX, check: IconCheck, pencil: IconPencil,
  refresh: IconRefresh, trash: IconTrash, eye: IconEye, "eye-off": IconEyeOff, up: IconChevronUp,
  down: IconChevronDown, search: IconSearch, locate: IconCurrentLocation, download: IconDownload, upload: IconUpload,
  alert: IconAlertTriangle, shield: IconShieldLock, info: IconInfoCircle, grip: IconGripVertical, star: IconStar,
  bolt: IconBolt, calendar: IconCalendar, world: IconWorld, notes: IconNotes, heart: IconHeart,
  briefcase: IconBriefcase, school: IconSchool, "arrow-up": IconArrowUp, "arrow-down": IconArrowDown,
  sunrise: IconSunrise, sunset: IconSunset, umbrella: IconUmbrella, wind: IconWind, temperature: IconTemperature,
  palette: IconPalette, keyboard: IconKeyboard, sidebar: IconLayoutSidebar, tools: IconTools, database: IconDatabase,
  activity: IconActivity, droplet: IconDroplet,
};

/** Icons offered in the sidebar editor. */
export const PICKABLE_ICONS = ["home", "dashboard", "cloud", "chart-line", "clock", "world", "calendar", "notes",
  "star", "heart", "bolt", "briefcase", "school", "map-pin", "tools", "activity", "box"];

export function Icon({ name, size = 18, stroke = 1.6, className, style }:
  { name: string; size?: number; stroke?: number; className?: string; style?: React.CSSProperties }) {
  const C = ICONS[name] ?? IconBox;
  return <C size={size} stroke={stroke} className={className} style={style} aria-hidden />;
}

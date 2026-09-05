/**
 * Icon lookup for the catalog. Strategies name a lucide icon as a string so
 * the catalog stays pure data; this maps it to the component.
 */
import {
  Activity,
  CalendarClock,
  Coins,
  Compass,
  Crosshair,
  Gauge,
  Gem,
  LineChart,
  Lightbulb,
  Radar,
  RotateCcw,
  Telescope,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { StrategySection } from "./catalog";

const ICONS: Record<string, LucideIcon> = {
  Activity,
  CalendarClock,
  Coins,
  Compass,
  Gauge,
  Gem,
  Radar,
  RotateCcw,
  Telescope,
  TrendingUp,
  UserCheck,
  Users,
};

export const strategyIcon = (name: string): LucideIcon => ICONS[name] ?? TrendingUp;

export const SECTION_ICONS: Record<StrategySection, LucideIcon> = {
  IDEA_DISCOVERY: Lightbulb,
  ENTRY_TIMING: Crosshair,
  MARKET_MONITORING: LineChart,
};

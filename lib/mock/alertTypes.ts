import {
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  TrendingUp,
  Activity,
  Signal,
  Waves,
  CalendarClock,
} from "lucide-react";

export interface AlertTypeOption {
  id: string;
  name: string;
  description: string;
  icon: typeof ArrowUpRight;
  category: string;
}

export const alertTypeOptions: AlertTypeOption[] = [
  {
    id: "PRICE_ABOVE",
    name: "Price Above",
    description: "Alert when price crosses above a target.",
    icon: ArrowUpRight,
    category: "Price Alerts",
  },
  {
    id: "PRICE_BELOW",
    name: "Price Below",
    description: "Alert when price crosses below a target.",
    icon: ArrowDownRight,
    category: "Price Alerts",
  },
  {
    id: "PERCENT_CHANGE_DAY",
    name: "% Change (Day)",
    description: "Daily move exceeds a % threshold.",
    icon: Percent,
    category: "Change Alerts",
  },
  {
    id: "PERCENT_CHANGE_CUSTOM",
    name: "% Change (Custom)",
    description: "Move from alert creation price.",
    icon: TrendingUp,
    category: "Change Alerts",
  },
  {
    id: "RSI_OVERBOUGHT",
    name: "RSI Overbought",
    description: "RSI crosses above threshold.",
    icon: Activity,
    category: "Technical",
  },
  {
    id: "RSI_OVERSOLD",
    name: "RSI Oversold",
    description: "RSI crosses below threshold.",
    icon: Activity,
    category: "Technical",
  },
  {
    id: "SMA_CROSS_ABOVE",
    name: "SMA Cross Above",
    description: "Price crosses above SMA.",
    icon: Signal,
    category: "Technical",
  },
  {
    id: "SMA_CROSS_BELOW",
    name: "SMA Cross Below",
    description: "Price crosses below SMA.",
    icon: Signal,
    category: "Technical",
  },
  {
    id: "VOLUME_SPIKE",
    name: "Volume Spike",
    description: "Volume exceeds X times average.",
    icon: Waves,
    category: "Volume",
  },
  {
    id: "FIFTY_TWO_WEEK_HIGH",
    name: "52-Week High",
    description: "New 52-week high print.",
    icon: ArrowUpRight,
    category: "Milestones",
  },
  {
    id: "FIFTY_TWO_WEEK_LOW",
    name: "52-Week Low",
    description: "New 52-week low print.",
    icon: ArrowDownRight,
    category: "Milestones",
  },
  {
    id: "EARNINGS_REMINDER",
    name: "Earnings Reminder",
    description: "Alert days before earnings.",
    icon: CalendarClock,
    category: "Events",
  },
];

export const alertTypeCategories = [
  "Price Alerts",
  "Change Alerts",
  "Technical",
  "Volume",
  "Milestones",
  "Events",
];

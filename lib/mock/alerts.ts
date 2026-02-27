export interface MockAlert {
  id: string;
  ticker: string;
  companyName: string;
  alertType: string;
  triggerValue: number;
  triggerDirection: "ABOVE" | "BELOW" | "BOTH";
  currentPrice: number;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: string;
  note?: string;
  cooldownMinutes: number;
}

export interface MockAlertHistoryItem {
  id: string;
  alertId: string;
  ticker: string;
  alertType: string;
  priceAtTrigger: number;
  triggeredAt: string;
  aiSummary: string;
}

export const mockAlerts: MockAlert[] = [
  {
    id: "alert-1",
    ticker: "AAPL",
    companyName: "Apple Inc.",
    alertType: "PRICE_ABOVE",
    triggerValue: 230,
    triggerDirection: "ABOVE",
    currentPrice: 223.45,
    isActive: true,
    isTriggered: false,
    cooldownMinutes: 20,
    note: "Breakout watch",
  },
  {
    id: "alert-2",
    ticker: "NVDA",
    companyName: "NVIDIA Corp.",
    alertType: "VOLUME_SPIKE",
    triggerValue: 2.5,
    triggerDirection: "ABOVE",
    currentPrice: 905.7,
    isActive: true,
    isTriggered: true,
    triggeredAt: "2026-02-27T14:18:00Z",
    cooldownMinutes: 20,
  },
  {
    id: "alert-3",
    ticker: "TSLA",
    companyName: "Tesla Inc.",
    alertType: "PERCENT_CHANGE_DAY",
    triggerValue: 7,
    triggerDirection: "BOTH",
    currentPrice: 248.9,
    isActive: true,
    isTriggered: false,
    cooldownMinutes: 60,
  },
  {
    id: "alert-4",
    ticker: "SPY",
    companyName: "SPDR S&P 500 ETF Trust",
    alertType: "SMA_CROSS_BELOW",
    triggerValue: 200,
    triggerDirection: "BELOW",
    currentPrice: 524.8,
    isActive: false,
    isTriggered: true,
    triggeredAt: "2026-02-25T19:40:00Z",
    cooldownMinutes: 240,
  },
];

export const mockAlertHistory: MockAlertHistoryItem[] = [
  {
    id: "history-1",
    alertId: "alert-2",
    ticker: "NVDA",
    alertType: "VOLUME_SPIKE",
    priceAtTrigger: 899.2,
    triggeredAt: "2026-02-27T14:18:00Z",
    aiSummary:
      "NVDA volume spiked to 2.7x its 20-day average as price pushed toward the upper end of today's range. Traders watch whether elevated volume confirms a breakout or fades into the close.",
  },
  {
    id: "history-2",
    alertId: "alert-4",
    ticker: "SPY",
    alertType: "SMA_CROSS_BELOW",
    priceAtTrigger: 512.7,
    triggeredAt: "2026-02-25T19:40:00Z",
    aiSummary:
      "SPY slipped below its 200-day SMA on heavier-than-average volume, signaling a possible trend shift. Many traders monitor follow-through in the next 1-3 sessions for confirmation.",
  },
  {
    id: "history-3",
    alertId: "alert-1",
    ticker: "AAPL",
    alertType: "PRICE_ABOVE",
    priceAtTrigger: 230,
    triggeredAt: "2026-02-21T15:05:00Z",
    aiSummary:
      "AAPL cleared the $230 level while trading within 4% of its 52-week high. Traders often watch for hold-above retests after a breakout, especially heading into earnings.",
  },
];

export const formatPrice = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);

export const formatPercent = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

export const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);

export const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

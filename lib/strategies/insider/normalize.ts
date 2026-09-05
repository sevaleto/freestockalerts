/**
 * Insider-transaction normalization. The provider's field names and casing are
 * not stable, so everything downstream works on this shape only.
 */
import { INSIDER } from "../config";

export interface RawInsiderTransaction {
  symbol?: string;
  filingDate?: string;
  transactionDate?: string;
  reportingCik?: string;
  companyCik?: string;
  transactionType?: string;
  securitiesOwned?: number | string | null;
  reportingName?: string;
  typeOfOwner?: string;
  acquisitionOrDisposition?: string;
  directOrIndirect?: string;
  formType?: string;
  securitiesTransacted?: number | string | null;
  price?: number | string | null;
  securityName?: string;
  url?: string;
  [key: string]: unknown;
}

export interface NormalizedInsiderTransaction {
  symbol: string;
  dedupKey: string;
  accession: string | null;
  insiderName: string;
  insiderTitle: string | null;
  ownerType: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isSenior: boolean;
  /** Single-letter SEC code (P, S, A, M, G, C, F, ...) or "" when the provider left it blank. */
  transactionCode: string;
  acquisitionOrDisposition: string | null;
  securityName: string | null;
  transactionDate: string; // YYYY-MM-DD
  filingDate: string | null;
  shares: number;
  price: number;
  value: number;
  sharesOwnedAfter: number | null;
  filingUrl: string | null;
  raw: RawInsiderTransaction;
}

const num = (v: unknown): number | null => {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
};

const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** "0001193125-26-384028" from the EDGAR index URL, when present. */
export function accessionFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = /(\d{10}-\d{2}-\d{6})/.exec(url);
  return m ? m[1] : null;
}

/** "P-Purchase" → "P"; "S-Sale" → "S"; "" → "". */
export function transactionCode(type: string | undefined | null): string {
  if (!type) return "";
  const m = /^([A-Z])\b/.exec(type.trim().toUpperCase());
  return m ? m[1] : "";
}

/** Officer title after "officer:" in typeOfOwner, e.g. "Chief Executive Officer". */
export function officerTitle(ownerType: string | undefined | null): string | null {
  if (!ownerType) return null;
  const m = /officer:\s*(.+)$/i.exec(ownerType);
  return m ? m[1].trim() : null;
}

export interface Role {
  isDirector: boolean;
  isOfficer: boolean;
  isSenior: boolean;
  /** Director, or an officer whose title makes them a relevant insider. */
  isRelevant: boolean;
  title: string | null;
}

/** Roles from the provider's free-text "typeOfOwner". A 10% owner alone is not a relevant insider. */
export function classifyRole(ownerType: string | undefined | null): Role {
  const text = (ownerType ?? "").toLowerCase();
  const isDirector = /\bdirector\b/.test(text);
  const isOfficer = /\bofficer\b/.test(text);
  const title = officerTitle(ownerType);
  const titleText = title ?? "";
  const isSenior = INSIDER.seniorTitlePatterns.some((re) => re.test(titleText));
  const relevantOfficer = isOfficer && (isSenior || INSIDER.relevantOfficerPatterns.some((re) => re.test(titleText)));
  return { isDirector, isOfficer, isSenior, isRelevant: isDirector || relevantOfficer, title };
}

export function normalizeInsiderTransaction(raw: RawInsiderTransaction): NormalizedInsiderTransaction | null {
  const symbol = (raw.symbol ?? "").trim().toUpperCase();
  const transactionDate = day(raw.transactionDate);
  const insiderName = (raw.reportingName ?? "").trim();
  if (!symbol || !transactionDate || !insiderName) return null;
  const shares = num(raw.securitiesTransacted) ?? 0;
  const price = num(raw.price) ?? 0;
  const code = transactionCode(raw.transactionType);
  const accession = accessionFromUrl(raw.url);
  const role = classifyRole(raw.typeOfOwner);
  const identity = [symbol, raw.reportingCik ?? insiderName, transactionDate, code, shares, price].join("|");
  return {
    symbol,
    dedupKey: `${accession ?? "noacc"}|${identity}`,
    accession,
    insiderName,
    insiderTitle: role.title,
    ownerType: raw.typeOfOwner ?? null,
    isDirector: role.isDirector,
    isOfficer: role.isOfficer,
    isSenior: role.isSenior,
    transactionCode: code,
    acquisitionOrDisposition: raw.acquisitionOrDisposition ?? null,
    securityName: raw.securityName ?? null,
    transactionDate,
    filingDate: day(raw.filingDate),
    shares,
    price,
    value: shares * price,
    sharesOwnedAfter: num(raw.securitiesOwned),
    filingUrl: typeof raw.url === "string" && raw.url ? raw.url : null,
    raw,
  };
}

/** Common stock and ordinary shares only; preferred, warrants, units, notes and derivatives are not. */
export function isCommonStock(securityName: string | null | undefined): boolean {
  if (!securityName) return true; // provider left it blank; the code/price rules still apply
  const s = securityName.toLowerCase();
  if (/preferred|preference|warrant|\bunits?\b|\bnotes?\b|debenture|option|rsu|restricted stock unit|convertible|depositary/.test(s)) return false;
  return /common|ordinary|class [a-c]\b/.test(s) || /^shares?$/.test(s.trim());
}

/** A single insider's description for an alert, e.g. "Jane Doe, Chief Executive Officer" or "John Roe, Director". */
export function describeInsider(t: Pick<NormalizedInsiderTransaction, "insiderName" | "insiderTitle" | "isDirector">): string {
  const title = t.insiderTitle ?? (t.isDirector ? "Director" : "Insider");
  return `${prettyName(t.insiderName)}, ${title}`;
}

/** EDGAR names arrive as "LAST FIRST" or "Last First"; present them first name first, in title case. */
export function prettyName(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(" ");
  const titled = parts.map((p) => (p.length <= 2 && /^[A-Z.]+$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()));
  // EDGAR lists "LAST FIRST [MIDDLE]" without a comma. Move the first name to the front.
  if (!cleaned.includes(",") && titled.length >= 2 && titled.length <= 4) {
    if (/^[A-Z]\.?$/.test(parts[parts.length - 1]) && titled.length >= 3) {
      // "Doe Jane A." → "Jane A. Doe"
      return `${titled[titled.length - 2]} ${titled[titled.length - 1]} ${titled.slice(0, -2).join(" ")}`;
    }
    // "Engert Oliver" → "Oliver Engert"; "De Lange Bob" → "Bob De Lange"
    return `${titled[titled.length - 1]} ${titled.slice(0, -1).join(" ")}`;
  }
  return titled.join(" ").replace(/,$/, "");
}

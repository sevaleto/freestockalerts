/**
 * SEC Form 4 parsing. Pure functions over EDGAR text, so the ingest, the tests
 * and any future backfill all read filings the same way. Schema reference:
 * https://www.sec.gov/info/edgar/ownershipxmltechspec.htm
 */
import type { RawInsiderTransaction } from "@/lib/strategies/insider/normalize";

/* ------------------------------ daily index ------------------------------ */

export interface FormIndexEntry {
  formType: string;
  companyName: string;
  cik: string;
  /** YYYY-MM-DD */
  dateFiled: string;
  /** e.g. edgar/data/320193/0001140361-26-037020.txt */
  fileName: string;
  accession: string;
}

const ROW = /^(\S+(?: \S+)*?)\s{2,}(.+?)\s{2,}(\d+)\s+(\d{8})\s+(edgar\/\S+)\s*$/;

/** Rows of a daily form.YYYYMMDD.idx for the given form types, one per accession. */
export function parseFormIndex(text: string, formTypes: readonly string[] = ["4"]): FormIndexEntry[] {
  const wanted = new Set(formTypes);
  const seen = new Set<string>();
  const out: FormIndexEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = ROW.exec(line);
    if (!m || !wanted.has(m[1])) continue;
    const acc = /(\d{10}-\d{2}-\d{6})\.txt$/.exec(m[5]);
    if (!acc || seen.has(acc[1])) continue;
    seen.add(acc[1]);
    const d = m[4];
    out.push({ formType: m[1], companyName: m[2].trim(), cik: m[3], dateFiled: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, fileName: m[5], accession: acc[1] });
  }
  return out;
}

/* ---------------------------------- XML ---------------------------------- */

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

const blocks = (xml: string, tag: string): string[] => {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push(m[1]);
  return out;
};
const block = (xml: string, tag: string): string | null => blocks(xml, tag)[0] ?? null;

/** Text of `<tag>`, reading through a nested `<value>` when present. */
const text = (xml: string | null, tag: string): string | null => {
  if (!xml) return null;
  const inner = block(xml, tag);
  if (inner === null) return null;
  const v = block(inner, "value");
  const raw = (v ?? inner).replace(/<[^>]+>/g, "").trim();
  return raw ? decode(raw) : null;
};
const flag = (xml: string | null, tag: string) => {
  const t = (text(xml, tag) ?? "").toLowerCase();
  return t === "1" || t === "true";
};
const number = (xml: string | null, tag: string): number | null => {
  const t = text(xml, tag);
  if (t === null) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

export interface Form4Owner {
  cik: string | null;
  name: string;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  isOther: boolean;
  officerTitle: string | null;
  otherText: string | null;
}

export interface Form4Transaction {
  /** Position in the non-derivative table, stable across re-reads. */
  seq: number;
  securityTitle: string | null;
  transactionDate: string | null;
  code: string;
  shares: number | null;
  price: number | null;
  acquiredDisposed: string | null;
  sharesOwnedAfter: number | null;
  directOrIndirect: string | null;
}

export interface Form4Doc {
  documentType: string | null;
  periodOfReport: string | null;
  issuerCik: string | null;
  issuerName: string | null;
  symbol: string | null;
  owners: Form4Owner[];
  nonDerivative: Form4Transaction[];
}

/** The <ownershipDocument> inside a full EDGAR submission (.txt), or null. */
export function extractOwnershipXml(submission: string): string | null {
  const m = /<ownershipDocument>[\s\S]*?<\/ownershipDocument>/.exec(submission);
  return m ? m[0] : null;
}

export function parseForm4Xml(xml: string): Form4Doc {
  const issuer = block(xml, "issuer");
  const owners: Form4Owner[] = blocks(xml, "reportingOwner").map((o) => {
    const id = block(o, "reportingOwnerId");
    const rel = block(o, "reportingOwnerRelationship");
    return {
      cik: text(id, "rptOwnerCik"),
      name: text(id, "rptOwnerName") ?? "",
      isDirector: flag(rel, "isDirector"),
      isOfficer: flag(rel, "isOfficer"),
      isTenPercentOwner: flag(rel, "isTenPercentOwner"),
      isOther: flag(rel, "isOther"),
      officerTitle: text(rel, "officerTitle"),
      otherText: text(rel, "otherText"),
    };
  });
  const table = block(xml, "nonDerivativeTable") ?? "";
  const nonDerivative: Form4Transaction[] = blocks(table, "nonDerivativeTransaction").map((t, seq) => ({
    seq,
    securityTitle: text(t, "securityTitle"),
    transactionDate: (text(t, "transactionDate") ?? "").slice(0, 10) || null,
    code: (text(block(t, "transactionCoding"), "transactionCode") ?? "").toUpperCase(),
    shares: number(block(t, "transactionAmounts"), "transactionShares"),
    price: number(block(t, "transactionAmounts"), "transactionPricePerShare"),
    acquiredDisposed: text(block(t, "transactionAmounts"), "transactionAcquiredDisposedCode"),
    sharesOwnedAfter: number(block(t, "postTransactionAmounts"), "sharesOwnedFollowingTransaction"),
    directOrIndirect: text(block(t, "ownershipNature"), "directOrIndirectOwnership"),
  }));
  return {
    documentType: text(xml, "documentType"),
    periodOfReport: text(xml, "periodOfReport"),
    issuerCik: text(issuer, "issuerCik"),
    issuerName: text(issuer, "issuerName"),
    symbol: (text(issuer, "issuerTradingSymbol") ?? "").toUpperCase() || null,
    owners,
    nonDerivative,
  };
}

/** "director, officer: Chief Executive Officer, 10 percent owner" — the phrasing the insider normalizer reads. */
export function ownerTypeText(o: Form4Owner): string {
  const parts: string[] = [];
  if (o.isDirector) parts.push("director");
  if (o.isOfficer) parts.push(o.officerTitle ? `officer: ${o.officerTitle}` : "officer");
  if (o.isTenPercentOwner) parts.push("10 percent owner");
  if (o.isOther) parts.push(o.otherText ? `other: ${o.otherText}` : "other");
  return parts.join(", ");
}

/** Joint filings list several owners; the scan cares about the director or officer when there is one. */
export function primaryOwner(owners: Form4Owner[]): Form4Owner | null {
  return owners.find((o) => o.isDirector || o.isOfficer) ?? owners[0] ?? null;
}

export const filingIndexUrl = (issuerCik: string, accession: string) =>
  `https://www.sec.gov/Archives/edgar/data/${Number(issuerCik)}/${accession.replace(/-/g, "")}/${accession}-index.htm`;

/**
 * Open-market purchases (non-derivative, code P) in the provider-neutral raw
 * shape normalizeInsiderTransaction() reads. Other codes are dropped here.
 */
export function purchasesFromForm4(doc: Form4Doc, meta: { accession: string; filingDate: string; formType: string }): Array<RawInsiderTransaction & { seq: number }> {
  const owner = primaryOwner(doc.owners);
  if (!doc.symbol || !owner) return [];
  const url = doc.issuerCik ? filingIndexUrl(doc.issuerCik, meta.accession) : undefined;
  return doc.nonDerivative
    .filter((t) => t.code === "P" && t.transactionDate)
    .map((t) => ({
      seq: t.seq,
      symbol: doc.symbol!,
      companyName: doc.issuerName ?? undefined,
      filingDate: meta.filingDate,
      transactionDate: t.transactionDate!,
      reportingCik: owner.cik ?? undefined,
      companyCik: doc.issuerCik ?? undefined,
      transactionType: "P-Purchase",
      securitiesOwned: t.sharesOwnedAfter,
      reportingName: owner.name,
      typeOfOwner: ownerTypeText(owner),
      acquisitionOrDisposition: t.acquiredDisposed ?? undefined,
      directOrIndirect: t.directOrIndirect ?? undefined,
      formType: meta.formType,
      securitiesTransacted: t.shares,
      price: t.price,
      securityName: t.securityTitle ?? undefined,
      url,
      source: "sec-edgar",
    }));
}

/* --------------------------- shares outstanding --------------------------- */

interface ConceptFact {
  end?: string;
  val?: number;
  filed?: string;
  accn?: string;
}

/**
 * Latest shares outstanding from an XBRL companyconcept payload
 * (dei:EntityCommonStockSharesOutstanding). Multi-class issuers report one
 * fact per class for the same filing and date; those are summed.
 */
export function latestSharesOutstanding(payload: unknown): number | null {
  const facts = ((payload as { units?: { shares?: ConceptFact[] } } | null)?.units?.shares ?? []).filter(
    (f) => typeof f.val === "number" && f.val > 0 && f.end && f.accn
  );
  if (!facts.length) return null;
  facts.sort((a, b) => (a.end! < b.end! ? 1 : a.end! > b.end! ? -1 : (a.filed ?? "") < (b.filed ?? "") ? 1 : -1));
  const top = facts[0];
  const sameFiling = facts.filter((f) => f.accn === top.accn && f.end === top.end);
  const distinct = [...new Set(sameFiling.map((f) => f.val!))];
  return distinct.reduce((a, b) => a + b, 0);
}

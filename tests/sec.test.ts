import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractOwnershipXml, latestSharesOutstanding, parseForm4Xml, parseFormIndex, primaryOwner, purchasesFromForm4, ownerTypeText } from "../lib/sec/form4";
import { businessDaysBack, ingestInsiderFilings } from "../lib/sec/ingest";
import { parseTreasuryCsv } from "../lib/api/treasury";
import { classifyRole, normalizeInsiderTransaction } from "../lib/strategies/insider/normalize";
import { isQualifyingPurchase } from "../lib/strategies/insider/evaluate";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", "sec", name), "utf8");
const PURCHASE = fixture("0001536588-26-000034.txt"); // real filing: JCTC, 10% owner group, code P (2026-09-25)
const OTHER = fixture("0001535264-26-000053.txt"); // real filing without a purchase

const INDEX = `Description:           Daily Index of EDGAR Dissemination Feed by Form Type
Last Data Received:    Sep 25, 2026

Form Type   Company Name                                                  CIK
      Date Filed  File Name
---------------------------------------------------------------------------------------------------------------------------------------------
1-A POS          Modern Mining Technology Corp.                                1898722     20260925    edgar/data/1898722/0001213900-26-103507.txt
4                908 Devices Inc.                                              1555279     20260925    edgar/data/1555279/0001535264-26-000053.txt
4                ABBOTT LABORATORIES                                           1800        20260925    edgar/data/1800/0001306119-26-000009.txt
4                ABBOTT LABORATORIES                                           1800        20260925    edgar/data/1800/0001306119-26-000009.txt
4/A              ACME CORP                                                     42          20260925    edgar/data/42/0000000042-26-000001.txt
SC 13G/A         SOME FUND LP                                                  99          20260925    edgar/data/99/0000000099-26-000002.txt
`;

test("parseFormIndex keeps Form 4 rows once per accession and reads every column", () => {
  const rows = parseFormIndex(INDEX);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    formType: "4",
    companyName: "908 Devices Inc.",
    cik: "1555279",
    dateFiled: "2026-09-25",
    fileName: "edgar/data/1555279/0001535264-26-000053.txt",
    accession: "0001535264-26-000053",
  });
  assert.equal(parseFormIndex(INDEX, ["4", "4/A"]).length, 3);
});

test("parseForm4Xml reads issuer, every owner and the non-derivative table of a real filing", () => {
  const doc = parseForm4Xml(extractOwnershipXml(PURCHASE)!);
  assert.equal(doc.documentType, "4");
  assert.equal(doc.symbol, "JCTC");
  assert.equal(doc.issuerCik, "0000885307");
  assert.equal(doc.issuerName, "JEWETT CAMERON TRADING CO LTD");
  assert.equal(doc.owners.length, 4);
  assert.equal(doc.owners[0].name, "AJB Investment Fund II, LP");
  assert.equal(doc.owners[0].isTenPercentOwner, true);
  const first = doc.nonDerivative[0];
  assert.equal(first.code, "P");
  assert.equal(first.transactionDate, "2026-09-23");
  assert.equal(first.shares, 11);
  assert.equal(first.price, 2.929);
  assert.equal(first.acquiredDisposed, "A");
});

test("purchasesFromForm4 produces rows the insider normalizer accepts", () => {
  const doc = parseForm4Xml(extractOwnershipXml(PURCHASE)!);
  const rows = purchasesFromForm4(doc, { accession: "0001536588-26-000034", filingDate: "2026-09-25", formType: "4" });
  assert.ok(rows.length >= 1);
  assert.ok(rows.every((r) => r.transactionType === "P-Purchase"));
  const n = normalizeInsiderTransaction(rows[0])!;
  assert.equal(n.symbol, "JCTC");
  assert.equal(n.transactionCode, "P");
  assert.equal(n.accession, "0001536588-26-000034", "accession recovered from the filing URL");
  assert.equal(n.filingDate, "2026-09-25");
  assert.equal(n.ownerType, "10 percent owner");
  assert.equal(rows[0].url, "https://www.sec.gov/Archives/edgar/data/885307/000153658826000034/0001536588-26-000034-index.htm");
  // A 10% owner group buying $32 of stock is correctly not a qualifying insider purchase.
  assert.equal(isQualifyingPurchase(n, new Date("2026-09-28T23:00:00Z")).ok, false);
});

test("a filing without open-market purchases yields no rows", () => {
  const xml = extractOwnershipXml(OTHER)!;
  const doc = parseForm4Xml(xml);
  assert.ok(doc.symbol);
  assert.deepEqual(purchasesFromForm4(doc, { accession: "0001535264-26-000053", filingDate: "2026-09-25", formType: "4" }), []);
  assert.equal(extractOwnershipXml("<SEC-DOCUMENT>no xml here</SEC-DOCUMENT>"), null);
});

const OFFICER_XML = `<ownershipDocument>
  <documentType>4</documentType>
  <issuer><issuerCik>0000012345</issuerCik><issuerName>Example &amp; Co</issuerName><issuerTradingSymbol>exm</issuerTradingSymbol></issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>0000000001</rptOwnerCik><rptOwnerName>Big Fund LP</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship><isTenPercentOwner>1</isTenPercentOwner></reportingOwnerRelationship>
  </reportingOwner>
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>0000000002</rptOwnerCik><rptOwnerName>DOE JANE</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship><isDirector>true</isDirector><isOfficer>1</isOfficer><officerTitle>Chief Executive Officer &amp; President</officerTitle></reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <securityTitle><value>Common Stock</value></securityTitle>
      <transactionDate><value>2026-09-24</value></transactionDate>
      <transactionCoding><transactionCode>S</transactionCode></transactionCoding>
      <transactionAmounts><transactionShares><value>500</value></transactionShares><transactionPricePerShare><value>50</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode></transactionAmounts>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <securityTitle><value>Common Stock</value></securityTitle>
      <transactionDate><value>2026-09-25</value></transactionDate>
      <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
      <transactionAmounts><transactionShares><value>10,000</value></transactionShares><transactionPricePerShare><value>41.25</value><footnoteId id="F1"/></transactionPricePerShare><transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts>
      <postTransactionAmounts><sharesOwnedFollowingTransaction><value>60000</value></sharesOwnedFollowingTransaction></postTransactionAmounts>
      <ownershipNature><directOrIndirectOwnership><value>D</value></directOrIndirectOwnership></ownershipNature>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

test("joint filings attribute the purchase to the director or officer, with the title decoded", () => {
  const doc = parseForm4Xml(OFFICER_XML);
  assert.equal(doc.symbol, "EXM");
  assert.equal(doc.issuerName, "Example & Co");
  assert.equal(primaryOwner(doc.owners)!.name, "DOE JANE");
  assert.equal(ownerTypeText(primaryOwner(doc.owners)!), "director, officer: Chief Executive Officer & President");
  const rows = purchasesFromForm4(doc, { accession: "0000000002-26-000123", filingDate: "2026-09-26", formType: "4" });
  assert.equal(rows.length, 1, "the sale is dropped");
  assert.equal(rows[0].seq, 1, "seq is the row's position in the table");
  const n = normalizeInsiderTransaction(rows[0])!;
  assert.equal(n.shares, 10000);
  assert.equal(n.price, 41.25);
  assert.equal(n.value, 412500);
  assert.equal(n.sharesOwnedAfter, 60000);
  assert.equal(classifyRole(n.ownerType).isSenior, true);
  assert.equal(isQualifyingPurchase(n, new Date("2026-09-28T23:00:00Z")).ok, true);
});

test("latestSharesOutstanding takes the newest filing and sums share classes reported together", () => {
  const payload = {
    units: {
      shares: [
        { end: "2026-04-20", val: 900, filed: "2026-05-01", accn: "A1" },
        { end: "2026-07-18", val: 600, filed: "2026-08-01", accn: "A2" },
        { end: "2026-07-18", val: 400, filed: "2026-08-01", accn: "A2" },
      ],
    },
  };
  assert.equal(latestSharesOutstanding(payload), 1000);
  assert.equal(latestSharesOutstanding({ units: { shares: [] } }), null);
  assert.equal(latestSharesOutstanding(null), null);
});

test("parseTreasuryCsv maps tenors by header name, newest first", () => {
  const csv = `Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"
09/25/2026,4.04,4.14,4.20,4.24,4.32,4.33,4.50,4.81,4.94,4.98,5.06,5.17,5.54,5.49
09/28/2026,4.04,4.14,4.20,4.28,4.33,4.41,4.59,4.92,5.01,5.06,5.15,5.24,5.60,5.56
`;
  const rows = parseTreasuryCsv(csv);
  assert.deepEqual(rows[0], { date: "2026-09-28", month3: 4.28, year2: 4.92, year10: 5.24, year30: 5.56 });
  assert.equal(rows[1].date, "2026-09-25");
  assert.deepEqual(parseTreasuryCsv(""), []);
});

test("businessDaysBack lists weekdays newest first", () => {
  assert.deepEqual(businessDaysBack(new Date("2026-09-28T12:00:00Z"), 3), ["2026-09-28", "2026-09-25"]);
});

/* ------------------------ ingest with an in-memory db ----------------------- */

function fakeDb() {
  const filings = new Map<string, any>();
  const purchases = new Map<string, any>();
  const days = new Map<string, any>();
  const inList = (v: string, where: any) => !where?.in || where.in.includes(v);
  return {
    filings,
    purchases,
    days,
    secIndexDay: {
      findMany: async ({ where }: any) => [...days.values()].filter((d) => inList(d.date, where.date)),
      upsert: async ({ where, create, update }: any) => days.set(where.date, { ...(days.get(where.date) ?? create), ...update }),
      deleteMany: async () => ({ count: 0 }),
    },
    secForm4Filing: {
      findMany: async ({ where }: any) => [...filings.values()].filter((f) => inList(f.accession, where.accession)),
      upsert: async ({ where, create }: any) => (filings.has(where.accession) ? null : filings.set(where.accession, create)),
      deleteMany: async () => ({ count: 0 }),
    },
    secInsiderPurchase: {
      createMany: async ({ data }: any) => {
        for (const d of data) purchases.set(`${d.accession}|${d.seq}`, d);
        return { count: data.length };
      },
      deleteMany: async () => ({ count: 0 }),
    },
  };
}

test("ingest reads a day's filings, stores purchases, marks the day done, and does nothing on the next run", async () => {
  const realFetch = globalThis.fetch;
  const urls: string[] = [];
  const indexBody = INDEX.replace("4/A              ACME", "8-K              ACME");
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("form.20260925.idx")) return new Response(indexBody, { status: 200 });
    if (url.includes("/daily-index/")) return new Response("", { status: 403 }); // other days not published
    if (url.endsWith("0001535264-26-000053.txt")) return new Response(OTHER, { status: 200 });
    if (url.endsWith("0001306119-26-000009.txt")) return new Response(PURCHASE.replace("0001536588-26-000034", "0001306119-26-000009"), { status: 200 });
    return new Response("", { status: 404 });
  }) as typeof fetch;
  try {
    const db = fakeDb();
    const now = new Date("2026-09-28T12:00:00Z");
    const first = await ingestInsiderFilings({ db: db as never, now, lookbackDays: 3, budgetMs: 60_000 });
    assert.deepEqual(first.daysCompleted, ["2026-09-25"]);
    assert.deepEqual(first.daysUnpublished, ["2026-09-28"]);
    assert.equal(first.filingsRead, 2);
    assert.ok(first.purchasesFound >= 1);
    assert.equal(db.filings.size, 2);
    assert.ok([...db.purchases.values()].every((p) => p.symbol === "JCTC" && p.accession === "0001306119-26-000009"));

    const before = urls.length;
    const second = await ingestInsiderFilings({ db: db as never, now, lookbackDays: 3, budgetMs: 60_000 });
    assert.equal(second.filingsRead, 0);
    assert.deepEqual(second.daysChecked, ["2026-09-28"], "completed days are skipped without a request");
    assert.equal(urls.length - before, 1, "only today's unpublished index is asked for");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a failed filing fetch leaves the day open so the next run retries it", async () => {
  const realFetch = globalThis.fetch;
  let fail = true;
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url.endsWith("form.20260925.idx")) return new Response(INDEX, { status: 200 });
    if (url.includes("/daily-index/")) return new Response("", { status: 403 });
    if (url.endsWith("0001306119-26-000009.txt") && fail) return new Response("", { status: 503 });
    return new Response(OTHER, { status: 200 });
  }) as typeof fetch;
  try {
    const db = fakeDb();
    const now = new Date("2026-09-28T12:00:00Z");
    const first = await ingestInsiderFilings({ db: db as never, now, lookbackDays: 3, budgetMs: 60_000 });
    assert.equal(first.fetchErrors, 1);
    assert.deepEqual(first.daysCompleted, []);
    assert.equal(db.filings.size, 1);
    fail = false;
    const second = await ingestInsiderFilings({ db: db as never, now, lookbackDays: 3, budgetMs: 60_000 });
    assert.equal(second.filingsRead, 1, "only the failed filing is re-read");
    assert.deepEqual(second.daysCompleted, ["2026-09-25"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

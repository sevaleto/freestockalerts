/**
 * Read models for the admin pages: subscriber search and the cohort report.
 * Raw SQL for the grouped report; Prisma for everything else.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { cohortLabel } from "./cohort";

export interface CohortRow {
  cohortKey: string;
  source: string;
  medium: string;
  campaign: string;
  subscribers: number;
  /** Subscribers with any credited click (alert or newsletter). */
  clickers: number;
  /** Alert-email ad clicks through our redirect. */
  alertClicks: number;
  /** Unique newsletter link clicks reported by Beehiiv (both lists). */
  newsletterClicks: number;
  /** Alert click value (stamped) + newsletter clicks × the current newsletter value. */
  revenueCents: number;
  costCents: number | null;
}

export interface CohortFilter {
  /** YYYY-MM of firstSeenAt; null = all time. */
  month: string | null;
  /** app | beehiiv_fsa | beehiiv_si | null (attribution source). */
  source: string | null;
  /** Cents credited per unique newsletter click. */
  newsletterValueCents: number;
}

export interface ClickCounts {
  clickValueCents: number;
  beehiivFsaUniqueClicks: number;
  beehiivSiUniqueClicks: number;
  beehiivFsaUniqueClicksBaseline: number;
  beehiivSiUniqueClicksBaseline: number;
}

/** Unique newsletter clicks since tracking started (lifetime count minus the baseline frozen on first sight). */
export const newsletterClicksFor = (s: Omit<ClickCounts, "clickValueCents">) =>
  Math.max(0, s.beehiivFsaUniqueClicks - s.beehiivFsaUniqueClicksBaseline) + Math.max(0, s.beehiivSiUniqueClicks - s.beehiivSiUniqueClicksBaseline);

/** Pure revenue rule, shared by the report SQL and the subscriber pages. */
export const revenueCentsFor = (s: ClickCounts, newsletterValueCents: number) => s.clickValueCents + newsletterClicksFor(s) * newsletterValueCents;

export async function cohortReport(db: PrismaClient, filter: CohortFilter): Promise<CohortRow[]> {
  const conds: Prisma.Sql[] = [];
  if (filter.month) conds.push(Prisma.sql`to_char(s."firstSeenAt", 'YYYY-MM') = ${filter.month}`);
  if (filter.source) conds.push(Prisma.sql`s."attributionSource" = ${filter.source}`);
  const where = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty;
  const costJoin = filter.month
    ? Prisma.sql`LEFT JOIN "CohortCost" c ON c."cohortKey" = s."cohortKey" AND c.month = ${filter.month}`
    : Prisma.sql`LEFT JOIN (SELECT "cohortKey", SUM("costCents") AS "costCents" FROM "CohortCost" GROUP BY "cohortKey") c ON c."cohortKey" = s."cohortKey"`;
  const value = Math.max(0, Math.round(filter.newsletterValueCents));
  const rows = await db.$queryRaw<{ cohortKey: string; subscribers: bigint; clickers: bigint; alertClicks: bigint; newsletterClicks: bigint; alertValueCents: bigint; costCents: bigint | null }[]>(Prisma.sql`
    SELECT s."cohortKey",
           COUNT(*)::bigint AS "subscribers",
           COUNT(*) FILTER (WHERE s."countedClicks" > 0 OR s."beehiivFsaUniqueClicks" > s."beehiivFsaUniqueClicksBaseline" OR s."beehiivSiUniqueClicks" > s."beehiivSiUniqueClicksBaseline")::bigint AS "clickers",
           COALESCE(SUM(s."countedClicks"), 0)::bigint AS "alertClicks",
           COALESCE(SUM(GREATEST(s."beehiivFsaUniqueClicks" - s."beehiivFsaUniqueClicksBaseline", 0) + GREATEST(s."beehiivSiUniqueClicks" - s."beehiivSiUniqueClicksBaseline", 0)), 0)::bigint AS "newsletterClicks",
           COALESCE(SUM(s."clickValueCents"), 0)::bigint AS "alertValueCents",
           MAX(c."costCents")::bigint AS "costCents"
    FROM "Subscriber" s
    ${costJoin}
    ${where}
    GROUP BY s."cohortKey"
    ORDER BY "subscribers" DESC
  `);
  return rows.map((r) => ({
    cohortKey: r.cohortKey,
    ...cohortLabel(r.cohortKey),
    subscribers: Number(r.subscribers),
    clickers: Number(r.clickers),
    alertClicks: Number(r.alertClicks),
    newsletterClicks: Number(r.newsletterClicks),
    revenueCents: Number(r.alertValueCents) + Number(r.newsletterClicks) * value,
    costCents: r.costCents === null ? null : Number(r.costCents),
  }));
}

/** Months that have subscribers, newest first, for the filter. */
export async function cohortMonths(db: PrismaClient): Promise<string[]> {
  const rows = await db.$queryRaw<{ month: string }[]>(Prisma.sql`SELECT DISTINCT to_char("firstSeenAt", 'YYYY-MM') AS month FROM "Subscriber" ORDER BY month DESC LIMIT 60`);
  return rows.map((r) => r.month);
}

export const PAGE_SIZE = 50;

export async function searchSubscribers(db: PrismaClient, opts: { q: string; page: number; clickersOnly: boolean }) {
  const q = opts.q.trim().toLowerCase();
  // Column-to-column comparison is not expressible in Prisma's where; resolve clicker ids in SQL first.
  const clickerIds = opts.clickersOnly
    ? (await db.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "Subscriber" WHERE "countedClicks" > 0 OR "beehiivFsaUniqueClicks" > "beehiivFsaUniqueClicksBaseline" OR "beehiivSiUniqueClicks" > "beehiivSiUniqueClicksBaseline"`)).map((r) => r.id)
    : null;
  const where: Prisma.SubscriberWhereInput = {
    ...(q ? { OR: [{ email: { contains: q } }, { utmCampaign: { contains: q, mode: "insensitive" } }, { utmSource: { contains: q, mode: "insensitive" } }] } : {}),
    ...(clickerIds ? { id: { in: clickerIds } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.subscriber.count({ where }),
    db.subscriber.findMany({ where, orderBy: [{ beehiivSiUniqueClicks: "desc" }, { countedClicks: "desc" }, { firstSeenAt: "desc" }], skip: (opts.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Sent issues with their links, newest first. */
export async function newsletterIssues(db: PrismaClient, opts: { publication: string | null; take?: number }) {
  return db.newsletterPost.findMany({
    where: { ...(opts.publication ? { publication: opts.publication } : {}), recipients: { gt: 0 } },
    orderBy: { publishDate: "desc" },
    take: opts.take ?? 40,
    include: { links: { orderBy: { emailUniqueClicks: "desc" } } },
  });
}

/** Header totals for /admin/subscribers, clamped per row exactly like the report and the rows themselves. */
export async function subscriberTotals(db: PrismaClient): Promise<{ subscribers: number; newsletterClicks: number; alertClicks: number; alertValueCents: number }> {
  const [row] = await db.$queryRaw<{ subscribers: bigint; newsletterClicks: bigint; alertClicks: bigint; alertValueCents: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "subscribers",
           COALESCE(SUM(GREATEST("beehiivFsaUniqueClicks" - "beehiivFsaUniqueClicksBaseline", 0) + GREATEST("beehiivSiUniqueClicks" - "beehiivSiUniqueClicksBaseline", 0)), 0)::bigint AS "newsletterClicks",
           COALESCE(SUM("countedClicks"), 0)::bigint AS "alertClicks",
           COALESCE(SUM("clickValueCents"), 0)::bigint AS "alertValueCents"
    FROM "Subscriber"`);
  return { subscribers: Number(row?.subscribers ?? 0), newsletterClicks: Number(row?.newsletterClicks ?? 0), alertClicks: Number(row?.alertClicks ?? 0), alertValueCents: Number(row?.alertValueCents ?? 0) };
}

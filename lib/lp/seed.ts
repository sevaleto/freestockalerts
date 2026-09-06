/**
 * Seed the LandingPage / HeadlineVariant tables from the static config.
 *
 * Create-if-missing only: the admin owns the rows once they exist, so
 * re-running the seed never overwrites an edit or resets a test. Also folds
 * the pre-table homepage test values (`hero_headline:<key>`) on User rows
 * into the new `home:<key>` format, once, idempotently.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { LANDING_PAGES } from "@/lib/lp/pages";
import { HOME_RECORD } from "@/lib/lp/home";
import { HOME_SLUG, recordFromStatic, type PageRecord } from "@/lib/lp/view";

type Db = PrismaClient | Prisma.TransactionClient;

export interface LandingPageSeedSummary {
  created: string[];
  existing: string[];
  /** User rows whose signupVariant was rewritten from hero_headline:<key> to home:<key>. */
  rewrittenUsers: number;
}

export function seedRecords(): PageRecord[] {
  return [HOME_RECORD, ...Object.values(LANDING_PAGES).map(recordFromStatic)];
}

async function createIfMissing(db: Db, record: PageRecord): Promise<boolean> {
  const exists = await db.landingPage.findUnique({ where: { slug: record.slug }, select: { id: true } });
  if (exists) return false;
  await db.landingPage.create({
    data: {
      slug: record.slug,
      kind: record.kind,
      status: record.status,
      templateSlug: record.templateSlug,
      eyebrow: record.eyebrow,
      logicLine: record.logicLine,
      bullets: record.bullets,
      ctaLabel: record.ctaLabel,
      googleLabel: record.googleLabel,
      proofTitle: record.proofTitle,
      disclosure: record.disclosure,
      afterSignupNote: record.afterSignupNote,
      sampleAlert: record.sampleAlert ? (record.sampleAlert as unknown as Prisma.InputJsonValue) : undefined,
      ogTitle: record.ogTitle,
      ogDescription: record.ogDescription,
      createdBy: "seed",
      variants: {
        create: record.variants.map((v) => ({ key: v.key, headline: v.headline, subheadline: v.subheadline, weight: v.weight, isActive: v.isActive })),
      },
    },
  });
  return true;
}

export async function seedLandingPages(db: Db): Promise<LandingPageSeedSummary> {
  const summary: LandingPageSeedSummary = { created: [], existing: [], rewrittenUsers: 0 };
  for (const record of seedRecords()) {
    (await createIfMissing(db, record)) ? summary.created.push(record.slug) : summary.existing.push(record.slug);
  }
  summary.rewrittenUsers = await db.$executeRaw`
    UPDATE "User"
    SET "signupVariant" = replace("signupVariant", 'hero_headline:', ${HOME_SLUG + ":"})
    WHERE "signupVariant" LIKE 'hero_headline:%'`;
  return summary;
}

import { PrismaClient } from "@prisma/client";
import { seedTemplates } from "../lib/templates/seed";
import { STRATEGIES } from "../lib/templates/catalog";

const prisma = new PrismaClient();

async function main() {
  for (const s of STRATEGIES) {
    console.log(`seeding ${s.slug} (${s.items.length} alerts, refreshed ${s.lastRefreshedAt || "never"})`);
    if (s.items.length === 0 && s.kind !== "signal") console.warn(`  ! ${s.slug} has no constituents yet; run npm run refresh:strategies first`);
  }
  const summary = await seedTemplates(prisma);
  console.log(`upserted ${summary.upserted.length}, retired ${summary.retired.join(", ") || "none"}` + (summary.absent.length ? ` (not present: ${summary.absent.join(", ")})` : ""));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

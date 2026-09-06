/**
 * Full subscriber sync from the command line, for the first load or a
 * rebuild. Uses DATABASE_URL and BEEHIIV_API_KEY from the environment:
 *
 *   set -a; source .env.local; set +a
 *   npm run sync:subscribers                 # app users → tracked subscribers → Beehiiv lookups → latest issues
 *   npm run sync:subscribers -- --full si    # mirror one whole publication (not used by the cron)
 */
import { PrismaClient } from "@prisma/client";
import { publicationByKey } from "../lib/beehiiv/config";
import { syncAll, syncBeehiivPublication } from "../lib/subscribers/sync";

async function main() {
  const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  console.log(`database: ${(process.env.DATABASE_URL ?? "").replace(/:\/\/.*@/, "://***@")}`);
  const started = Date.now();
  if (process.argv[2] === "--full") {
    const pub = publicationByKey(process.argv[3] ?? "");
    if (!pub) throw new Error(`--full needs a publication key (fsa | si)`);
    const result = await syncBeehiivPublication({ db, pub, maxPages: 5000, log: (m) => console.log(`  ${m}`) });
    console.log(JSON.stringify(result), `in ${Math.round((Date.now() - started) / 1000)}s`);
    await db.$disconnect();
    return;
  }
  const result = await syncAll({ db, log: (m) => console.log(`  ${m}`) });
  console.log(JSON.stringify(result), `in ${Math.round((Date.now() - started) / 1000)}s`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

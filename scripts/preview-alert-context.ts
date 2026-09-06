/**
 * See exactly what a subscriber would read, for a real ticker, before shipping
 * a prompt change. Gathers live facts from FMP, prints the rendered prompt,
 * the paragraphs Claude wrote (or the fallback), token usage, and the cost.
 *
 *   set -a; source .env.local; set +a
 *   npm run preview:context -- NVDA "hits a new 52-week high" quality-breakout-radar
 *   npm run preview:context -- XLE "crosses above its 50-day moving average"
 *
 * Without ANTHROPIC_API_KEY the deterministic fallback is shown instead.
 */
import { fetchFmpQuote } from "../lib/api/fmp";
import { buildAlertContext } from "../lib/alerts/context";
import { gatherAlertFacts, renderAlertPrompt, wordCount, writeAlertContext } from "../lib/ai/alertContext";
import { AI_CONTEXT } from "../lib/ai/config";

const [ticker, triggerText = "hits a new 52-week high", strategySlug] = process.argv.slice(2);
if (!ticker) {
  console.error('usage: npm run preview:context -- TICKER "trigger text" [strategy-slug]');
  process.exit(1);
}

async function main() {
  const quote = await fetchFmpQuote(ticker);
  if (!quote) throw new Error(`no quote for ${ticker}`);
  const context = await buildAlertContext({ ...quote, ticker });
  const facts = await gatherAlertFacts({
    ticker,
    companyName: quote.companyName,
    triggerText,
    quote,
    contextLines: context.lines,
    volumeRatio: context.volumeRatio,
    strategySlug: strategySlug ?? null,
  });
  const { system, user } = renderAlertPrompt(facts);
  console.log("=== SYSTEM PROMPT ===\n" + system + "\n");
  console.log("=== USER PROMPT ===\n" + user + "\n");
  const written = await writeAlertContext(facts);
  console.log(`=== OUTPUT (${written.source}${written.model ? `, ${written.model}` : ""}${written.reason ? `, ${written.reason}` : ""}) ===`);
  console.log(written.paragraphs.join("\n\n"));
  console.log(`\n${wordCount(written.text)} words`);
  if (written.usage) {
    const u = written.usage;
    console.log(`tokens in=${u.inputTokens} out=${u.outputTokens}  cost=$${u.costUsd.toFixed(5)} per alert  ($${(u.costUsd * 1000).toFixed(2)} per 1,000 alerts at ${AI_CONTEXT.model} list prices)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

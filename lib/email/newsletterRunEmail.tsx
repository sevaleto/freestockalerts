import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { BuildResult, SlotResult } from "@/lib/newsletter/build";

const navy = "#0F172A";
const muted = "#64748B";

const STATUS_LABEL: Record<SlotResult["status"], string> = {
  drafted: "Draft ready",
  needs_review: "Needs review",
  failed: "Failed",
  skipped: "Already drafted",
  pending: "Pending",
};

const STATUS_COLOR: Record<SlotResult["status"], string> = {
  drafted: "#07875F",
  needs_review: "#D97706",
  failed: "#DC2626",
  skipped: muted,
  pending: muted,
};

/** The run report sent after every newsletter build: what got drafted, where to click, what to fix. */
export function NewsletterRunEmail({ result, adminUrl }: { result: BuildResult; adminUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>{result.paused ? "Newsletter builds are paused" : `${result.slots.filter((s) => s.status === "drafted").length} draft(s) ready in Beehiiv`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" }}>
        <Container style={{ padding: "24px" }}>
          <Heading style={{ margin: 0, fontSize: "20px", color: navy }}>FreeStockAlerts.AI drafts for {result.dateKey}</Heading>
          <Text style={{ fontSize: "13px", color: muted, marginTop: "6px" }}>
            Ads copied from The Smart Investor issues dated {result.tsiDateKey}. Run took {Math.round(result.ms / 1000)}s and cost ${result.totalCostUsd.toFixed(3)}.
          </Text>

          {result.paused ? <Text style={{ color: "#D97706", fontWeight: 600 }}>Builds are paused in the admin. Nothing was created.</Text> : null}

          {result.slots.map((s) => (
            <Section key={s.slot} style={{ marginTop: "16px", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "12px" }}>
              <Text style={{ margin: 0, fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: STATUS_COLOR[s.status] }}>
                Issue {s.slot}: {STATUS_LABEL[s.status]}
              </Text>
              <Text style={{ margin: "6px 0 0", fontSize: "16px", fontWeight: 600, color: navy }}>
                {s.ticker ? `${s.ticker}: ` : ""}
                {s.headline ?? (s.error ? "No article" : "")}
              </Text>
              {s.subjectLine ? <Text style={{ margin: "4px 0 0", fontSize: "13px", color: muted }}>Subject: {s.subjectLine}</Text> : null}
              {s.beehiivPostUrl ? (
                <Text style={{ margin: "8px 0 0" }}>
                  <Link href={s.beehiivPostUrl} style={{ color: "#0F8075", fontWeight: 600 }}>
                    Open in Beehiiv
                  </Link>
                </Text>
              ) : null}
              <Text style={{ margin: "8px 0 0", fontSize: "13px", color: navy }}>
                Ads: {s.adsFound} of 2{s.tsiPostTitle ? ` from "${s.tsiPostTitle}"` : " (no Smart Investor issue matched)"}
                {s.tsiAdvertisers ? ` — ${s.tsiAdvertisers}` : ""}
              </Text>
              {s.reviewReason ? <Text style={{ margin: "8px 0 0", fontSize: "13px", color: "#D97706" }}>Review: {s.reviewReason}</Text> : null}
              {s.error ? <Text style={{ margin: "8px 0 0", fontSize: "13px", color: "#DC2626" }}>Error: {s.error}</Text> : null}
              <Text style={{ margin: "8px 0 0", fontSize: "12px", color: muted }}>Cost ${s.costUsd.toFixed(3)}</Text>
            </Section>
          ))}

          {result.warnings.length ? (
            <Section style={{ marginTop: "16px" }}>
              <Text style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: navy }}>Warnings</Text>
              {result.warnings.map((w, i) => (
                <Text key={i} style={{ margin: "4px 0 0", fontSize: "13px", color: navy }}>
                  • {w}
                </Text>
              ))}
            </Section>
          ) : null}

          <Hr style={{ marginTop: "24px", borderColor: "#E2E8F0" }} />
          <Text style={{ fontSize: "12px", color: muted }}>
            Rebuild or pause from <Link href={adminUrl} style={{ color: "#0F8075" }}>{adminUrl}</Link>. Drafts are not sent until you click Send in Beehiiv.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

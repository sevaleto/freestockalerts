import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { SignalRow } from "@/lib/strategies/present";

interface SignalEmailProps {
  strategyName: string;
  strategySlug: string;
  symbol: string;
  subject: string;
  explanation: string;
  rows: SignalRow[];
  score: number;
  maxScore: number | null;
  sourceLine: string;
  appUrl: string;
}

const navy = "#0F172A";

/** Email for an event-strategy signal (insider purchase, analyst cluster). Same look as the alert email. */
export function SignalEmail({ strategyName, strategySlug, symbol, subject, explanation, rows, score, maxScore, sourceLine, appUrl }: SignalEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" }}>
        <Container style={{ padding: "24px" }}>
          <Heading style={{ margin: 0, fontSize: "20px", color: navy }}>FreeStockAlerts.AI</Heading>
          <Text style={{ fontSize: "12px", marginTop: "12px", color: "#0F8075", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{strategyName}</Text>
          <Text style={{ fontSize: "18px", marginTop: "4px", color: navy, fontWeight: 600 }}>{subject}</Text>

          <Section style={{ marginTop: "16px", padding: "16px", backgroundColor: "#E9F5F1", borderRadius: "12px" }}>
            <Text style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: navy }}>Why it triggered</Text>
            <Text style={{ margin: "6px 0 0", color: navy }}>{explanation}</Text>
          </Section>

          <Section style={{ marginTop: "16px" }}>
            {rows.map((r) => (
              <Text key={`${r.label}-${r.value}`} style={{ margin: "0 0 4px", fontSize: "14px", color: navy }}>
                <span style={{ color: "#64748B" }}>{r.label}: </span>
                {r.href ? (
                  <Link href={r.href} style={{ color: "#0F8075" }}>
                    {r.value}
                  </Link>
                ) : (
                  r.value
                )}
              </Text>
            ))}
            {maxScore ? (
              <Text style={{ margin: "8px 0 0", fontSize: "13px", color: "#64748B" }}>
                Signal strength: {score} of {maxScore} points (more confirming factors, higher score).
              </Text>
            ) : null}
          </Section>

          <Section style={{ marginTop: "20px" }}>
            <Link
              href={`${appUrl}/templates/${strategySlug}`}
              style={{ display: "inline-block", padding: "12px 18px", backgroundColor: "#0F8075", color: "#ffffff", borderRadius: "8px", textDecoration: "none", fontWeight: 600 }}
            >
              See how this strategy works →
            </Link>
          </Section>

          <Text style={{ fontSize: "12px", color: "#64748B", marginTop: "16px" }}>Source: {sourceLine}</Text>

          <Hr style={{ marginTop: "24px", borderColor: "#E2E8F0" }} />
          <Text style={{ fontSize: "12px", color: "#64748B" }}>
            You&apos;re receiving this because you activated {strategyName} on FreeStockAlerts.AI. Turn it off any time from{" "}
            <Link href={`${appUrl}/dashboard/templates`} style={{ color: "#0F8075" }}>
              {appUrl}/dashboard/templates
            </Link>
            . {symbol} is a research prompt, not a recommendation.
          </Text>
          <Text style={{ fontSize: "11px", color: "#94A3B8", marginTop: "16px", lineHeight: "16px" }}>
            Educational information only. We&apos;re not financial advisors or broker-dealers, and nothing we share should be taken as personal investment advice. Insider purchases and analyst ratings describe what happened; they do not predict what happens next. Always do your own research and talk to a qualified professional before making any investment decisions.
          </Text>
          <Text style={{ fontSize: "11px", color: "#94A3B8", marginTop: "8px", lineHeight: "16px" }}>Wealthpire, Inc. 400 Continental Blvd. 6th Floor El Segundo, CA 90245</Text>
        </Container>
      </Body>
    </Html>
  );
}

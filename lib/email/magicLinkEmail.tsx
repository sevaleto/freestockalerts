import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface MagicLinkEmailProps {
  link: string;
  code: string;
  isNewUser: boolean;
  appUrl: string;
}

export const magicLinkSubject = (isNewUser: boolean) =>
  isNewUser
    ? "Your first stock alert is one click away"
    : "Your Free Stock Alerts login link";

export function MagicLinkEmail({ link, code, isNewUser, appUrl }: MagicLinkEmailProps) {
  const heading = isNewUser
    ? "Activate your account and get your first alert"
    : "Log in to your alerts";
  const body = isNewUser
    ? "Tap the button below to confirm your email and set up your first AI-powered stock alert. No password needed."
    : "Tap the button below to log in. No password needed.";
  const cta = isNewUser ? "Get My First Alert →" : "Log In →";
  const text = "#0F172A";
  const muted = "#64748B";

  return (
    <Html>
      <Head />
      <Preview>{isNewUser ? "One tap to activate your account and set your first alert." : "Your one-tap login link."}</Preview>
      <Body style={{ backgroundColor: "#F8FAFC", fontFamily: "Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif", margin: 0, padding: "24px 12px" }}>
        <Container style={{ maxWidth: "480px", backgroundColor: "#ffffff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "32px" }}>
          <Heading style={{ margin: 0, fontSize: "18px", color: text }}>FreeStockAlerts.AI</Heading>
          <Heading as="h2" style={{ margin: "20px 0 0", fontSize: "24px", lineHeight: "1.25", color: text }}>
            {heading}
          </Heading>
          <Text style={{ margin: "12px 0 0", fontSize: "16px", lineHeight: "1.5", color: "#475569" }}>{body}</Text>

          <Section style={{ textAlign: "center", marginTop: "28px" }}>
            <Link
              href={link}
              style={{
                display: "inline-block",
                backgroundColor: "#0F8075",
                color: "#ffffff",
                fontSize: "17px",
                fontWeight: 700,
                textDecoration: "none",
                padding: "16px 32px",
                borderRadius: "12px",
              }}
            >
              {cta}
            </Link>
          </Section>

          <Section style={{ marginTop: "28px", padding: "16px", backgroundColor: "#F1F5F9", borderRadius: "12px", textAlign: "center" }}>
            <Text style={{ margin: 0, fontSize: "13px", color: muted }}>
              On a different device? Enter this code on the page you signed up from:
            </Text>
            <Text style={{ margin: "8px 0 0", fontSize: "28px", fontWeight: 700, letterSpacing: "6px", fontFamily: "JetBrains Mono, Menlo, monospace", color: text }}>
              {code}
            </Text>
          </Section>

          <Text style={{ margin: "24px 0 0", fontSize: "12px", lineHeight: "1.5", color: muted }}>
            Button not working? Copy this link into your browser:
            <br />
            <Link href={link} style={{ color: "#0F8075", wordBreak: "break-all" }}>{link}</Link>
          </Text>

          <Text style={{ margin: "20px 0 0", fontSize: "12px", lineHeight: "1.5", color: "#94A3B8" }}>
            This link works on any device and expires in 1 hour. If you didn&apos;t request it, you can ignore this email.
          </Text>

          <Hr style={{ marginTop: "24px", borderColor: "#E2E8F0" }} />
          <Text style={{ fontSize: "11px", color: "#94A3B8", lineHeight: "16px" }}>
            Just so we&apos;re clear — we&apos;re not financial advisors or broker-dealers, and nothing we share should be taken as personal investment advice. Always do your own research and talk to a qualified professional before making any investment decisions.
          </Text>
          <Text style={{ fontSize: "11px", color: "#94A3B8", marginTop: "8px", lineHeight: "16px" }}>
            Wealthpire, Inc. 400 Continental Blvd. 6th Floor El Segundo, CA 90245 ·{" "}
            <Link href={appUrl} style={{ color: "#94A3B8" }}>{appUrl.replace(/^https?:\/\//, "")}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

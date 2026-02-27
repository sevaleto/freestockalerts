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

interface AlertEmailProps {
  ticker: string;
  alertType: string;
  currentPrice: string;
  triggerPrice: string;
  dayChange: string;
  volume: string;
  aiSummary: string;
  appUrl: string;
}

export function AlertEmail({
  ticker,
  alertType,
  currentPrice,
  triggerPrice,
  dayChange,
  volume,
  aiSummary,
  appUrl,
}: AlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`🔔 ${ticker} Alert: ${alertType}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" }}>
        <Container style={{ padding: "24px" }}>
          <Heading style={{ margin: 0, fontSize: "20px", color: "#0F172A" }}>
            FreeStockAlerts.AI
          </Heading>
          <Text style={{ fontSize: "18px", marginTop: "16px", color: "#0F172A" }}>
            {ticker} — {alertType} Triggered
          </Text>
          <Section style={{ marginTop: "16px" }}>
            <Text style={{ margin: 0, color: "#0F172A" }}>
              Current price: {currentPrice}
            </Text>
            <Text style={{ margin: 0, color: "#0F172A" }}>
              Trigger price: {triggerPrice}
            </Text>
            <Text style={{ margin: 0, color: "#0F172A" }}>
              Day change: {dayChange}
            </Text>
            <Text style={{ margin: 0, color: "#0F172A" }}>
              Volume: {volume}
            </Text>
          </Section>
          <Section
            style={{
              marginTop: "16px",
              padding: "16px",
              backgroundColor: "#EFF6FF",
              borderRadius: "12px",
            }}
          >
            <Text style={{ margin: 0, color: "#0F172A" }}>{aiSummary}</Text>
          </Section>
          <Section style={{ marginTop: "20px" }}>
            <Link
              href={`${appUrl}/dashboard/history`}
              style={{
                display: "inline-block",
                padding: "12px 18px",
                backgroundColor: "#2563EB",
                color: "#ffffff",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              View Alert Details →
            </Link>
          </Section>
          <Hr style={{ marginTop: "24px", borderColor: "#E2E8F0" }} />
          <Text style={{ fontSize: "12px", color: "#64748B" }}>
            You&apos;re receiving this because you set an alert for {ticker} on
            FreeStockAlerts.AI. Manage your alerts:{" "}
            <Link href={`${appUrl}/dashboard/history`} style={{ color: "#2563EB" }}>
              {appUrl}/dashboard/history
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

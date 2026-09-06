import type { Metadata } from "next";
import { Inter, JetBrains_Mono, DM_Serif_Display, Caveat } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { CookieConsentProvider } from "@/lib/cookies/CookieConsentContext";
import { CookieConsent } from "@/components/shared/CookieConsent";
import { TrackingScripts } from "@/components/shared/TrackingScripts";
import { CaptureAttribution } from "@/components/shared/CaptureAttribution";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const serif = DM_Serif_Display({
  variable: "--font-serif",
  weight: "400",
  subsets: ["latin"],
});

const script = Caveat({
  variable: "--font-script",
  weight: ["500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FreeStockAlerts.AI",
    template: "%s | FreeStockAlerts.AI",
  },
  description:
    "Free stock price alerts with plain-English context. No credit card. Free forever.",
  metadataBase: new URL("https://freestockalerts.ai"),
  openGraph: {
    title: "FreeStockAlerts.AI",
    description:
      "Real-time stock alerts with plain-English context. No credit card. Free forever.",
    url: "https://freestockalerts.ai",
    siteName: "FreeStockAlerts.AI",
    images: ["/og-image.png"],
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${serif.variable} ${script.variable}`}>
      <body className="min-h-screen bg-white text-text-primary antialiased">
        <CookieConsentProvider>
          {children}
          <CaptureAttribution />
          <TrackingScripts />
          <CookieConsent />
          <Toaster />
        </CookieConsentProvider>
      </body>
    </html>
  );
}

"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useCookieConsent } from "@/lib/cookies/CookieConsentContext";

/**
 * Conditionally loads tracking pixels based on user consent.
 *
 * Configure pixel IDs via environment variables:
 *   NEXT_PUBLIC_META_PIXEL_ID     — Facebook/Meta Pixel
 *   NEXT_PUBLIC_TIKTOK_PIXEL_ID   — TikTok Pixel
 *   NEXT_PUBLIC_GA_ID             — Google Analytics (future)
 *
 * Nothing loads until the user grants the relevant consent category.
 */

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";

export function TrackingScripts() {
  const { hasConsent } = useCookieConsent();

  const marketingConsent = hasConsent("marketing");
  const analyticsConsent = hasConsent("analytics");

  // Meta Pixel — init on consent
  useEffect(() => {
    if (marketingConsent && META_PIXEL_ID && typeof window !== "undefined") {
      // If fbq already loaded (e.g., navigated back), just track PageView
      if (typeof (window as any).fbq === "function") {
        (window as any).fbq("track", "PageView");
      }
    }
  }, [marketingConsent]);

  // TikTok Pixel — init on consent
  useEffect(() => {
    if (marketingConsent && TIKTOK_PIXEL_ID && typeof window !== "undefined") {
      if (typeof (window as any).ttq === "object") {
        (window as any).ttq.page();
      }
    }
  }, [marketingConsent]);

  return (
    <>
      {/* ── Meta Pixel ── */}
      {marketingConsent && META_PIXEL_ID && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `,
          }}
        />
      )}

      {/* Meta Pixel noscript fallback */}
      {marketingConsent && META_PIXEL_ID && (
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      )}

      {/* ── TikTok Pixel ── */}
      {marketingConsent && TIKTOK_PIXEL_ID && (
        <Script
          id="tiktok-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function (w, d, t) {
                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
                ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
                ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
                for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
                ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
                ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;
                ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e+""]=+new Date;ttq._o=ttq._o||{};ttq._o[e+""]=n||{};
                var a=document.createElement("script");a.type="text/javascript";a.async=!0;a.src=r+"?sdkid="+e+"&lib="+t;
                var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(a,s)};
                ttq.load('${TIKTOK_PIXEL_ID}');
                ttq.page();
              }(window, document, 'ttq');
            `,
          }}
        />
      )}

      {/* ── Google Analytics (future) ── */}
      {analyticsConsent && GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `,
            }}
          />
        </>
      )}
    </>
  );
}

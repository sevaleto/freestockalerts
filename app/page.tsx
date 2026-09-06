import { cookies } from "next/headers";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { InlineCta } from "@/components/landing/InlineCta";
import { TemplatePreview } from "@/components/landing/TemplatePreview";
import { Features } from "@/components/landing/Features";
import { Testimonials } from "@/components/landing/Testimonials";
import { HonestAnswer } from "@/components/lp/HonestAnswer";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { StickyCta } from "@/components/landing/StickyCta";
import { Footer } from "@/components/shared/Footer";
import { HeadlineExposure } from "@/components/ab/HeadlineExposure";
import { BUCKET_COOKIE, bucketFromCookie } from "@/lib/cookies/bucket";
import { getHomeHeadline } from "@/lib/lp/store";

interface HomePageProps {
  searchParams: Promise<{ v?: string | string[] }>;
}

/**
 * The hero headline is a split test managed in /admin/pages (page "home").
 * Reading the bucket cookie makes this page dynamic; the copy itself comes
 * from the data cache, so the cost is one cached lookup per request.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const [{ v }, jar] = await Promise.all([searchParams, cookies()]);
  const bucket = bucketFromCookie(jar.get(BUCKET_COOKIE)?.value);
  const headline = await getHomeHeadline(bucket, typeof v === "string" ? v.toUpperCase() : null);

  return (
    <main className="flex min-h-screen flex-col">
      <HeadlineExposure tag={headline.variantTag} count={!headline.forced} />
      <Hero headline={headline} />
      <HowItWorks />
      <InlineCta />
      <TemplatePreview />
      <Features />
      <Testimonials />
      <HonestAnswer ctaLabel="Set my first free alert" />
      <FinalCTA />
      <Footer />
      <StickyCta />
    </main>
  );
}

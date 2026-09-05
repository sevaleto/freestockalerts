import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { InlineCta } from "@/components/landing/InlineCta";
import { TemplatePreview } from "@/components/landing/TemplatePreview";
import { Features } from "@/components/landing/Features";
import { Testimonials } from "@/components/landing/Testimonials";
import { WhyFree } from "@/components/landing/WhyFree";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { StickyCta } from "@/components/landing/StickyCta";
import { Footer } from "@/components/shared/Footer";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Hero />
      <HowItWorks />
      <InlineCta />
      <TemplatePreview />
      <Features />
      <Testimonials />
      <WhyFree />
      <FinalCTA />
      <Footer />
      <StickyCta />
    </main>
  );
}

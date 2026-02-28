import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { TemplatePreview } from "@/components/landing/TemplatePreview";
import { Testimonials } from "@/components/landing/Testimonials";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/shared/Footer";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Hero />
      <HowItWorks />
      <Features />
      <TemplatePreview />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </main>
  );
}

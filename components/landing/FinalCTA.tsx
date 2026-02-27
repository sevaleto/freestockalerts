import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FinalCTA() {
  return (
    <section className="bg-primary py-20 text-white">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold md:text-4xl">
              Ready to stop missing trades?
            </h2>
            <p className="mt-4 text-base text-white/80">
              Free forever. Unsubscribe anytime.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              placeholder="Enter your email"
              className="h-12 bg-white text-text-primary"
            />
            <Button className="h-12 bg-white px-8 text-base text-primary hover:bg-white/90">
              Get Started Free →
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

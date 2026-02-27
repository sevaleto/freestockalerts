const testimonials = [
  {
    name: "Avery L.",
    role: "Swing Trader",
    quote:
      "The AI summaries are the difference-maker. I know why the alert fired and what to watch next without digging through charts.",
  },
  {
    name: "Marcus R.",
    role: "Long-term Investor",
    quote:
      "Templates saved me hours. I activated the value watchlist and got the exact entries I wanted within a day.",
  },
  {
    name: "Jasmine K.",
    role: "Options Trader",
    quote:
      "I set the alerts in five minutes. The notifications read like a concise market note, not just a price ping.",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="bg-white py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
              Social proof
            </p>
            <h2 className="text-3xl font-semibold text-text-primary md:text-4xl">
              Traders trust FreeStockAlerts.AI
            </h2>
            <p className="text-base text-text-secondary">
              A few words from early users testing the platform before launch.
            </p>
          </div>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map((item) => (
            <div key={item.name} className="rounded-3xl border border-border bg-surface p-6">
              <p className="text-sm text-text-secondary">“{item.quote}”</p>
              <div className="mt-6">
                <p className="text-sm font-semibold text-text-primary">{item.name}</p>
                <p className="text-xs text-text-muted">{item.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

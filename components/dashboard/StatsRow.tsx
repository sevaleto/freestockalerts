import { Card, CardContent } from "@/components/ui/card";

interface StatItem {
  label: string;
  value: string;
  subtext?: string;
}

interface StatsRowProps {
  stats: StatItem[];
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border shadow-soft">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              {stat.label}
            </p>
            <p className="text-2xl font-semibold text-text-primary">{stat.value}</p>
            {stat.subtext ? (
              <p className="text-xs text-text-secondary">{stat.subtext}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

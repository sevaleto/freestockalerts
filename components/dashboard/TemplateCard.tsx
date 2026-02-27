import Link from "next/link";
import { Switch } from "@/components/ui/switch";

interface TemplateCardProps {
  name: string;
  description: string;
  iconEmoji: string;
  alertsCount: number;
  subscribers: number;
  isActive: boolean;
  href?: string;
  onToggle?: (value: boolean) => void;
}

export function TemplateCard({
  name,
  description,
  iconEmoji,
  alertsCount,
  subscribers,
  isActive,
  href,
  onToggle,
}: TemplateCardProps) {
  return (
    <div className="rounded-3xl border border-border bg-white p-6 shadow-soft">
      <div className="flex items-start justify-between">
        <div className="text-3xl">{iconEmoji}</div>
        <Switch defaultChecked={isActive} onCheckedChange={onToggle} />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-text-primary">
        {href ? (
          <Link href={href} className="hover:text-primary">
            {name}
          </Link>
        ) : (
          name
        )}
      </h3>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
        <span>{alertsCount} alerts</span>
        <span>{subscribers.toLocaleString()} subscribers</span>
      </div>
    </div>
  );
}

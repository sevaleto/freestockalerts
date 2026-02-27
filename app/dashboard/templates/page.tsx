"use client";

import { useState } from "react";
import { TemplateCard } from "@/components/dashboard/TemplateCard";
import { mockTemplates } from "@/lib/mock/templates";

export default function DashboardTemplatesPage() {
  const [activeTemplates, setActiveTemplates] = useState(
    new Set(mockTemplates.filter((item) => item.isFeatured).map((item) => item.id))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Templates</h1>
        <p className="text-sm text-text-secondary">
          Activate curated alert strategies with one click.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {mockTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            name={template.name}
            description={template.description}
            iconEmoji={template.iconEmoji}
            alertsCount={template.items.length}
            subscribers={1250}
            isActive={activeTemplates.has(template.id)}
            href={`/templates/${template.slug}`}
            onToggle={(value) => {
              setActiveTemplates((prev) => {
                const next = new Set(prev);
                if (value) next.add(template.id);
                else next.delete(template.id);
                return next;
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { TemplateCard } from "@/components/dashboard/TemplateCard";
import { mockTemplates } from "@/lib/mock/templates";

export default function DashboardTemplatesPage() {
  const [templates, setTemplates] = useState(mockTemplates);
  const [activeTemplates, setActiveTemplates] = useState(new Set<string>());

  useEffect(() => {
    let isMounted = true;
    const fetchTemplates = async () => {
      try {
        const res = await fetch("/api/templates");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json?.data) {
          setTemplates(json.data);
        }
      } catch (error) {
        // fall back to mock data
      }
    };
    fetchTemplates();
    return () => {
      isMounted = false;
    };
  }, []);

  const featuredIds = useMemo(
    () => new Set(templates.filter((item) => item.isFeatured).map((item) => item.id)),
    [templates]
  );

  useEffect(() => {
    setActiveTemplates(featuredIds);
  }, [featuredIds]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Templates</h1>
        <p className="text-sm text-text-secondary">
          Activate curated alert strategies with one click.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-6 text-sm text-text-secondary">
          No templates available yet.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
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
      )}
    </div>
  );
}

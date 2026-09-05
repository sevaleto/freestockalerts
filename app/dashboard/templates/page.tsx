"use client";

import { useEffect, useMemo, useState } from "react";
import { TemplateCard } from "@/components/dashboard/TemplateCard";
import { getStrategy, orderedStrategies, SECTION_ORDER, SECTIONS, type StrategySection } from "@/lib/templates/catalog";
import { createBrowserClient } from "@supabase/ssr";

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  section?: StrategySection;
  triggerSummary?: string | null;
  refreshCadence?: string | null;
  isFeatured: boolean;
  items: unknown[];
}

/** Catalog copy of the list, shown until the API responds (or if it fails). */
const CATALOG_TEMPLATES: Template[] = orderedStrategies().map((s) => ({
  id: s.id,
  name: s.name,
  slug: s.slug,
  description: s.description,
  section: s.section,
  triggerSummary: s.triggerSummary,
  refreshCadence: s.refreshCadence,
  isFeatured: s.isFeatured,
  items: s.items,
}));

export default function DashboardTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(CATALOG_TEMPLATES);
  const [activeTemplates, setActiveTemplates] = useState(new Set<string>());
  const [userId, setUserId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(new Set<string>());

  // Get user on mount
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Fetch templates
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
      } catch {
        // fall back to mock data
      }
    };
    fetchTemplates();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch active subscriptions for current user
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    const fetchSubscriptions = async () => {
      try {
        const res = await fetch(`/api/user/subscriptions`);
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json?.data) {
          const activeIds = new Set<string>(
            json.data
              .filter((sub: { isActive: boolean }) => sub.isActive)
              .map((sub: { templateId: string }) => sub.templateId)
          );
          setActiveTemplates(activeIds);
        }
      } catch {
        // fall back to featured defaults
        setActiveTemplates(
          new Set(templates.filter((t) => t.isFeatured).map((t) => t.id))
        );
      }
    };
    fetchSubscriptions();
    return () => {
      isMounted = false;
    };
  }, [userId, templates]);

  const handleToggle = async (template: Template, value: boolean) => {
    if (!userId) return;

    // Optimistic update
    setActiveTemplates((prev) => {
      const next = new Set(prev);
      if (value) next.add(template.id);
      else next.delete(template.id);
      return next;
    });

    setToggling((prev) => new Set(prev).add(template.id));

    try {
      const endpoint = value ? "subscribe" : "unsubscribe";
      const res = await fetch(`/api/templates/${template.slug}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to update subscription");
    } catch {
      // Revert on failure
      setActiveTemplates((prev) => {
        const next = new Set(prev);
        if (value) next.delete(template.id);
        else next.add(template.id);
        return next;
      });
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  };

  const groups = useMemo(
    () =>
      SECTION_ORDER.map((id) => ({
        section: SECTIONS[id],
        templates: templates.filter((t) => (t.section ?? getStrategy(t.slug)?.section ?? "IDEA_DISCOVERY") === id),
      })).filter((g) => g.templates.length > 0),
    [templates]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Strategy templates</h1>
        <p className="text-sm text-text-secondary">
          Activate a ready-made alert strategy with one click. Preview any strategy to see its rules, trigger and current list.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-[20px] border border-border bg-white p-6 text-sm text-text-secondary">
          No templates available yet.
        </div>
      ) : (
        groups.map(({ section, templates: list }) => (
          <section key={section.id} aria-labelledby={`dash-${section.id}`} className="space-y-4">
            <div>
              <h2 id={`dash-${section.id}`} className="text-lg font-semibold text-text-primary">{section.label}</h2>
              <p className="text-sm text-text-secondary">{section.blurb}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {list.map((template) => (
                <TemplateCard
                  key={template.id}
                  name={template.name}
                  description={template.description}
                  icon={getStrategy(template.slug)?.icon ?? "TrendingUp"}
                  section={template.section ?? getStrategy(template.slug)?.section ?? "IDEA_DISCOVERY"}
                  triggerSummary={template.triggerSummary ?? getStrategy(template.slug)?.triggerSummary}
                  refreshCadence={template.refreshCadence ?? getStrategy(template.slug)?.refreshCadence}
                  alertsCount={template.items.length}
                  kind={getStrategy(template.slug)?.kind ?? "watchlist"}
                  isActive={activeTemplates.has(template.id)}
                  href={`/templates/${template.slug}`}
                  onToggle={(value) => handleToggle(template, value)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

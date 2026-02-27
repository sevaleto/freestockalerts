"use client";

import { useEffect, useMemo, useState } from "react";
import { TemplateCard } from "@/components/dashboard/TemplateCard";
import { mockTemplates } from "@/lib/mock/templates";
import { createBrowserClient } from "@supabase/ssr";

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconEmoji: string;
  isFeatured: boolean;
  items: unknown[];
}

export default function DashboardTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates as Template[]);
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
              onToggle={(value) => handleToggle(template, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

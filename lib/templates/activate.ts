import { Prisma, type Alert } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";

export class TemplateNotFoundError extends Error {
  constructor(slug: string) {
    super(`Template not found: ${slug}`);
    this.name = "TemplateNotFoundError";
  }
}

export class AlertLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`Alert limit of ${limit} reached`);
    this.name = "AlertLimitError";
  }
}

export interface ActivationResult {
  template: { id: string; slug: string; name: string; iconEmoji: string };
  alerts: Alert[];
  created: number;
  alreadyActive: boolean;
}

/**
 * Subscribe a user to a template and create its alerts. Idempotent: if the
 * user already has alerts from this template nothing new is created.
 * Used by the welcome page (auto-activation after signup) and the
 * authenticated activate API.
 */
export async function activateTemplateForUser(
  userId: string,
  templateSlug: string
): Promise<ActivationResult> {
  const template = await prisma.alertTemplate.findUnique({
    where: { slug: templateSlug },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new TemplateNotFoundError(templateSlug);

  const run = () =>
    prisma.$transaction(
      async (tx) => {
        await tx.templateSubscription.upsert({
          where: { userId_templateId: { userId, templateId: template.id } },
          create: { userId, templateId: template.id, isActive: true },
          update: { isActive: true },
        });

        const existing = await tx.alert.count({
          where: { userId, templateId: template.id },
        });

        let created = 0;
        if (existing === 0 && template.items.length > 0) {
          const [user, activeCount] = await Promise.all([
            tx.user.findUnique({ where: { id: userId }, select: { maxAlerts: true } }),
            tx.alert.count({ where: { userId, isActive: true } }),
          ]);
          const limit = user?.maxAlerts ?? 50;
          if (activeCount + template.items.length > limit) throw new AlertLimitError(limit);

          const result = await tx.alert.createMany({
            data: template.items.map((item) => ({
              userId,
              ticker: item.ticker.toUpperCase(),
              companyName: item.companyName ?? undefined,
              alertType: item.alertType,
              triggerValue: item.triggerValue,
              triggerDirection: item.triggerDirection,
              note: item.rationale ?? undefined,
              templateId: template.id,
            })),
          });
          created = result.count;
        }

        const alerts = await tx.alert.findMany({
          where: { userId, templateId: template.id },
          orderBy: { createdAt: "asc" },
        });

        return {
          template: {
            id: template.id,
            slug: template.slug,
            name: template.name,
            iconEmoji: template.iconEmoji,
          },
          alerts,
          created,
          alreadyActive: existing > 0,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

  try {
    return await run();
  } catch (err) {
    // A double-fired welcome render can collide; one retry resolves it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      return run();
    }
    throw err;
  }
}

import { PrismaClient } from "@prisma/client";
import { mockTemplates } from "../lib/mock/templates";

const prisma = new PrismaClient();

async function main() {
  for (const template of mockTemplates) {
    await prisma.alertTemplate.upsert({
      where: { slug: template.slug },
      update: {
        name: template.name,
        description: template.description,
        longDescription: template.longDescription,
        category: template.category,
        iconEmoji: template.iconEmoji,
        isActive: template.isActive,
        isFeatured: template.isFeatured,
        sortOrder: template.sortOrder,
      },
      create: {
        name: template.name,
        slug: template.slug,
        description: template.description,
        longDescription: template.longDescription,
        category: template.category,
        iconEmoji: template.iconEmoji,
        isActive: template.isActive,
        isFeatured: template.isFeatured,
        sortOrder: template.sortOrder,
        items: {
          create: template.items.map((item) => ({
            ticker: item.ticker,
            companyName: item.companyName,
            alertType: item.alertType as any,
            triggerValue: item.triggerValue,
            triggerDirection: item.triggerDirection as any,
            rationale: item.rationale,
            sortOrder: item.sortOrder,
          })),
        },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

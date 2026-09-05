"use client";

import Link from "next/link";
import { selectTemplate } from "@/lib/landing/pendingTemplate";

interface TemplateCardLinkProps {
  slug: string;
  name: string;
  className?: string;
  children: React.ReactNode;
}

/** Template card that feeds the signup form instead of leaving the page. */
export function TemplateCardLink({ slug, name, className, children }: TemplateCardLinkProps) {
  return (
    <Link
      href="#signup"
      className={className}
      onClick={() => selectTemplate({ slug, name })}
      aria-label={`Activate ${name} after signup`}
    >
      {children}
    </Link>
  );
}

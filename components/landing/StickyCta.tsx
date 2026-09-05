"use client";

import { useEffect, useState } from "react";

/** Mobile-only bar that appears once the hero signup form has scrolled past. */
export function StickyCta({ label = "Set my first free alert" }: { label?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      timer = null;
      const target = document.getElementById("signup");
      if (!target) return setShow(false);
      const bottom = target.getBoundingClientRect().bottom;
      // Past the form, and not already looking at the final CTA form.
      const finalForm = document.querySelector("section.bg-lp-navy");
      const finalTop = finalForm ? finalForm.getBoundingClientRect().top : Infinity;
      setShow(bottom < 0 && finalTop > window.innerHeight);
    };
    const onScroll = () => {
      if (!timer) timer = setTimeout(check, 80);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-lp-border bg-white/95 p-3 backdrop-blur md:hidden" data-sticky-cta>
      <a
        href="#signup"
        className="flex h-12 w-full items-center justify-center rounded-xl bg-lp-teal text-base font-semibold text-white shadow-sm"
      >
        {label}
      </a>
    </div>
  );
}

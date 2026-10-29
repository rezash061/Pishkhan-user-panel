"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface TabLink {
  href: string;
  label: string;
  /** Also active on sub-pages (for example a rule editor under the rules tab). */
  prefix?: boolean;
}

/** Route tabs under a page title; scroll sideways on phones instead of wrapping. */
export function SectionTabs({ tabs, className }: { tabs: TabLink[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0", className)}>
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.prefix === true && pathname.startsWith(`${tab.href}/`));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn("shrink-0 border-b-2 px-3 py-2.5 text-sm", active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Small exclusive choice (2–4 options), as a radio group. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-surface-muted p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn("rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-60", value === o.value ? "bg-surface font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

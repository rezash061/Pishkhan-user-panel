import { useId } from "react";
import { cn } from "@/lib/cn";

/** Placeholder mark until the final brand exists (plans: "replace the codename everywhere"). */
export function Logo({ className }: { className?: string }) {
  // Unique per instance: a hidden copy (desktop sidebar on phones) would otherwise own the shared gradient id.
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("size-8", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.6 0.2 330)" />
          <stop offset="1" stopColor="oklch(0.5 0.2 285)" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${id})`} />
      <path d="M14 30c0-6.6 4.5-12 10-12s10 5.4 10 12" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24" cy="31" r="3.2" fill="white" />
    </svg>
  );
}

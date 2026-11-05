import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const badge = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-surface-muted text-muted-foreground",
      primary: "bg-primary-soft text-primary",
      // The success colour is too light for small text on its soft background (3.2:1); badges use a darker shade (WCAG AA).
      success: "bg-success-soft text-[oklch(0.45_0.12_155)] dark:text-success",
      warning: "bg-warning-soft text-[oklch(0.5_0.12_70)] dark:text-warning",
      danger: "bg-danger-soft text-danger",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

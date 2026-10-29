import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Standard padded, width-limited page body inside the workspace shell. */
export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8", className)} {...props} />;
}

/** Save/cancel bar that stays at the bottom of the scrolling page while a long form is edited. */
export function StickyActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("sticky bottom-0 z-20 -mx-4 flex justify-end gap-2 border-t bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6", className)}
      {...props}
    />
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Standard padded, width-limited page body inside the workspace shell. */
export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8", className)} {...props} />;
}

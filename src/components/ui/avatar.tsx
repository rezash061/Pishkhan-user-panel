"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A round avatar: the photo when there is one and it loads, otherwise the first letter of the name.
 * Instagram photos come as short-lived signed URLs, so a failed load (expired link) falls back to the letter.
 */
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const letter = name.trim().charAt(0) || "؟";
  const base = cn("grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft text-sm font-semibold text-primary", className);
  if (src && failed !== src) {
    return (
      <span aria-hidden className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs; next/image would re-host them. */}
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setFailed(src)} />
      </span>
    );
  }
  return (
    <span aria-hidden className={base}>
      {letter}
    </span>
  );
}

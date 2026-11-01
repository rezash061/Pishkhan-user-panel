"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CrmTag } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** The nine tag colours the backend accepts. Each pairs a soft fill with readable ink in both themes. */
export const tagColors = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"] as const;
export type TagColor = (typeof tagColors)[number];

const tones: Record<TagColor, string> = {
  gray: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  yellow: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  purple: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  pink: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200",
};

/** Swatch colour for the picker (the dot), matched to the chip ink. */
export const swatches: Record<TagColor, string> = {
  gray: "bg-zinc-500",
  red: "bg-red-600",
  orange: "bg-orange-600",
  yellow: "bg-amber-500",
  green: "bg-green-600",
  teal: "bg-teal-600",
  blue: "bg-blue-600",
  purple: "bg-violet-600",
  pink: "bg-pink-600",
};

export function tagTone(color: string | null | undefined): string {
  return tones[(color ?? "gray") as TagColor] ?? tones.gray;
}

/** Map of tag name → colour, for painting chips from the tag list. */
export function tagColorMap(tags: CrmTag[] | undefined): Map<string, string | null> {
  return new Map((tags ?? []).map((t) => [t.name, t.color]));
}

export function TagChip({ name, color, onRemove, className }: { name: string; color?: string | null; onRemove?: () => void; className?: string }) {
  const t = useTranslations("contacts");
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tagTone(color), className)}>
      <span className="truncate" dir="auto">
        {name}
      </span>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={t("removeTag", { tag: name })} className="-me-1 rounded-full p-0.5 hover:bg-black/10">
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

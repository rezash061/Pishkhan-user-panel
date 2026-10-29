"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Free-text values as removable chips: Enter, comma («،» too) or Tab adds; Backspace on an empty box removes the last.
 * Pasting «قیمت، price، هزینه» adds three.
 */
export function ChipsInput({
  id,
  values,
  onChange,
  placeholder,
  max,
  maxLength,
  disabled,
  invalid,
  describedBy,
  renderChip,
  validate,
}: {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  renderChip?: (value: string) => ReactNode;
  /** Values that fail are not added. */
  validate?: (value: string) => boolean;
}) {
  const t = useTranslations("common");
  const [draft, setDraft] = useState("");
  const full = max !== undefined && values.length >= max;

  const add = (raw: string) => {
    const parts = raw
      .split(/[,،\n]/)
      .map((p) => p.trim())
      .filter((p) => p && (!validate || validate(p)));
    if (!parts.length) return false;
    const next = [...values];
    for (const p of parts) if (!next.includes(p) && (max === undefined || next.length < max)) next.push(p);
    onChange(next);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if ((e.key === "Enter" || e.key === "," || e.key === "،" || (e.key === "Tab" && draft.trim())) && draft.trim()) {
      e.preventDefault();
      if (add(draft)) setDraft("");
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border bg-surface px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        invalid && "border-danger",
        disabled && "opacity-60",
      )}
    >
      {values.map((v) => (
        <span key={v} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-primary-soft py-0.5 ps-2 pe-0.5 text-sm text-primary">
          <span className="truncate" dir="auto">
            {renderChip ? renderChip(v) : v}
          </span>
          {disabled ? null : (
            <button
              type="button"
              aria-label={`${t("delete")} ${v}`}
              className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-primary/10"
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </span>
      ))}
      <input
        id={id}
        dir="auto"
        value={draft}
        disabled={disabled || full}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={values.length ? undefined : placeholder}
        onChange={(e) => {
          const value = e.target.value;
          if (/[,،\n]/.test(value)) {
            if (add(value)) setDraft("");
            else setDraft(value.replace(/[,،\n]/g, ""));
          } else setDraft(value);
        }}
        onBlur={() => {
          if (draft.trim() && add(draft)) setDraft("");
        }}
        onKeyDown={onKeyDown}
        className="h-8 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
      />
    </div>
  );
}

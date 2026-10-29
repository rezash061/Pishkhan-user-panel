"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatNumber } from "@/lib/i18n/format";
import { MAX_PRICE_RIAL, parseToman, RIAL_PER_TOMAN } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * Price in Toman with Persian digits and thousands separators while typing («۸۹۰٬۰۰۰ تومان»). Value is whole Toman or
 * null; callers convert to backend Rial with `moneyFromToman`.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: number | null;
  onChange: (toman: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const t = useTranslations("catalog");
  const [focused, setFocused] = useState(false);
  const text = value === null ? "" : formatNumber(value);
  return (
    <div
      className={cn(
        "flex h-11 items-center rounded-xl border bg-surface focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        invalid && "border-danger",
        disabled && "opacity-60",
        className,
      )}
    >
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const toman = parseToman(e.target.value);
          if (toman !== null && toman * RIAL_PER_TOMAN > MAX_PRICE_RIAL) return;
          onChange(toman);
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-end text-sm tabular-nums outline-none placeholder:text-muted-foreground/70"
      />
      <span className={cn("shrink-0 pe-3 text-xs", focused ? "text-foreground" : "text-muted-foreground")}>{t("toman")}</span>
    </div>
  );
}

"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChipsInput } from "@/components/ui/chips-input";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import type { MatchMode } from "@/lib/api/types";
import { compilePattern, isUsableKeyword, keywordMatches, keywordVariants } from "@/lib/persian/keywords";

export const MAX_KEYWORDS = 50;

/**
 * Keywords + match type, with the Persian-normalized preview («این‌ها هم پیدا می‌شوند: قيمت، قیمت؟») and a box to try a
 * customer message against the rule before saving it (plan 3.4).
 */
export function KeywordInput({
  idPrefix,
  match,
  keywords,
  pattern,
  onChange,
  required,
  disabled,
  error,
}: {
  idPrefix: string;
  match: MatchMode;
  keywords: string[];
  pattern: string;
  onChange: (patch: { match?: MatchMode; keywords?: string[]; pattern?: string }) => void;
  required: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  const t = useTranslations("automations.keywords");
  const [sample, setSample] = useState("");
  const isPattern = match === "pattern";
  const patternInvalid = isPattern && pattern.trim() !== "" && compilePattern(pattern) === null;
  const hasAny = isPattern ? pattern.trim() !== "" : keywords.length > 0;
  const matched = sample.trim() ? keywordMatches({ match, keywords, pattern }, sample) : null;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span id={`${idPrefix}-match-label`} className="block text-sm font-medium">
          {t("matchLabel")}
        </span>
        <Segmented
          label={t("matchLabel")}
          value={match}
          disabled={disabled}
          onChange={(m) => onChange({ match: m })}
          options={(["contains", "exact", "any_of", "pattern"] as const).map((m) => ({ value: m, label: t(`match.${m}`) }))}
        />
        <p className="text-xs text-muted-foreground">{t(`matchHint.${match}`)}</p>
      </div>

      {isPattern ? (
        <Field label={t("pattern")} htmlFor={`${idPrefix}-pattern`} hint={t("patternHint")} error={error ?? (patternInvalid ? t("patternInvalid") : null)}>
          <Input id={`${idPrefix}-pattern`} dir="auto" maxLength={500} disabled={disabled} value={pattern} placeholder="قیمت*|price*" onChange={(e) => onChange({ pattern: e.target.value })} />
        </Field>
      ) : (
        <Field
          label={required ? t("keywords") : `${t("keywords")} (${t("optional")})`}
          htmlFor={`${idPrefix}-keywords`}
          hint={t("keywordsHint")}
          error={error}
        >
          <ChipsInput
            id={`${idPrefix}-keywords`}
            values={keywords}
            onChange={(k) => onChange({ keywords: k })}
            placeholder={t("keywordsPlaceholder")}
            max={MAX_KEYWORDS}
            maxLength={100}
            disabled={disabled}
            invalid={Boolean(error)}
            validate={isUsableKeyword}
          />
        </Field>
      )}

      {!isPattern && keywords.length ? (
        <div className="rounded-xl bg-surface-muted/70 p-3 text-xs leading-6">
          <p className="mb-1 font-medium text-foreground">{t("alsoMatches")}</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {keywords.slice(0, 5).map((k) => (
              <li key={k}>
                <span className="font-medium text-foreground">{k}</span>
                {" ← "}
                {keywordVariants(k).join("، ") || "—"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasAny ? (
        <Field label={t("tryLabel")} htmlFor={`${idPrefix}-try`}>
          <div className="space-y-1.5">
            <Input id={`${idPrefix}-try`} dir="auto" value={sample} placeholder={t("tryPlaceholder")} onChange={(e) => setSample(e.target.value)} />
            {matched === null ? null : (
              <p role="status" className={matched ? "flex items-center gap-1.5 text-xs text-success" : "flex items-center gap-1.5 text-xs text-muted-foreground"}>
                {matched ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
                {matched ? t("tryMatch") : t("tryNoMatch")}
              </p>
            )}
          </div>
        </Field>
      ) : null}
    </div>
  );
}

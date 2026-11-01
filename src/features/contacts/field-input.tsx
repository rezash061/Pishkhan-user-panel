"use client";

import { useTranslations } from "next-intl";
import { Input, Select } from "@/components/ui/field";
import type { FieldDefinition } from "@/lib/api/types";
import { toLatinDigits, toPersianDigits } from "@/lib/i18n/digits";
import { currentJalaliYear, isoToJalali, jalaliDaysInMonth, jalaliMonths, jalaliToIso } from "@/lib/i18n/jalali";

export const fieldTypes = ["text", "number", "date", "boolean", "email", "phone", "select"] as const;

/**
 * One custom field's value as the backend stores it (always a string): numbers with Latin digits, dates as yyyy-MM-dd
 * (picked in the Jalali calendar), booleans as "true"/"false", phones as typed (the backend turns them into E.164).
 */
export function FieldInput({
  id,
  field,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  field: Pick<FieldDefinition, "type" | "options" | "label">;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("contacts.fieldInput");
  const common = { id, disabled, "aria-invalid": invalid || undefined, "aria-describedby": describedBy };
  switch (field.type) {
    case "boolean":
      return (
        <Select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t("empty")}</option>
          <option value="true">{t("yes")}</option>
          <option value="false">{t("no")}</option>
        </Select>
      );
    case "select":
      return (
        <Select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t("empty")}</option>
          {[...new Set([...(field.options ?? []), ...(value && !field.options?.includes(value) ? [value] : [])])].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    case "date":
      return <JalaliDateInput id={id} value={value} onChange={onChange} disabled={disabled} label={field.label} />;
    case "number":
      return <Input {...common} inputMode="decimal" dir="ltr" value={toPersianDigits(value)} onChange={(e) => onChange(toLatinDigits(e.target.value).replace(/[٫,]/g, "."))} />;
    case "email":
      return <Input {...common} type="email" dir="ltr" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <Input {...common} type="tel" dir="ltr" inputMode="tel" value={value} onChange={(e) => onChange(toLatinDigits(e.target.value))} />;
    default:
      return <Input {...common} dir="auto" maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** Jalali day / month / year selects that read and write yyyy-MM-dd; an empty day clears the value. */
function JalaliDateInput({ id, value, onChange, disabled, label }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean; label: string }) {
  const t = useTranslations("contacts.fieldInput");
  const parts = /^\d{4}-\d{2}-\d{2}$/.test(value) ? isoToJalali(value) : null;
  const thisYear = currentJalaliYear();
  const year = parts?.year ?? thisYear;
  const month = parts?.month ?? 1;
  const years = Array.from({ length: 101 }, (_, i) => thisYear + 5 - i);
  if (parts && !years.includes(parts.year)) years.push(parts.year);
  const set = (y: number, m: number, d: number) => onChange(jalaliToIso(y, m, Math.min(d, jalaliDaysInMonth(y, m))));

  return (
    <div className="flex gap-2" role="group" aria-label={label}>
      <Select
        id={id}
        aria-label={t("day")}
        className="w-20"
        disabled={disabled}
        value={parts?.day ?? ""}
        onChange={(e) => (e.target.value ? set(year, month, Number(e.target.value)) : onChange(""))}
      >
        <option value="">{t("empty")}</option>
        {Array.from({ length: jalaliDaysInMonth(year, month) }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {toPersianDigits(d)}
          </option>
        ))}
      </Select>
      <Select aria-label={t("month")} className="flex-1" disabled={disabled || !parts} value={month} onChange={(e) => set(year, Number(e.target.value), parts?.day ?? 1)}>
        {jalaliMonths.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </Select>
      <Select aria-label={t("year")} className="w-24" disabled={disabled || !parts} value={year} onChange={(e) => set(Number(e.target.value), month, parts?.day ?? 1)}>
        {years.map((y) => (
          <option key={y} value={y}>
            {toPersianDigits(y)}
          </option>
        ))}
      </Select>
    </div>
  );
}

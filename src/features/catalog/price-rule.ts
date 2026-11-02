import type { PriceChangeRequest } from "@/lib/api/types";
import { toLatinDigits } from "@/lib/i18n/digits";
import { RIAL_PER_TOMAN } from "@/lib/money";

/** Rounding steps the backend accepts, in Toman (1 means whole Toman, i.e. no extra rounding). */
export const roundingSteps = [1, 100, 500, 1_000, 5_000, 10_000, 50_000, 100_000] as const;
export const roundModes = ["nearest", "up", "down"] as const;
export const percentLimits = { min: -90, max: 500 } as const;
/** How many preview rows the dialog lists before «and N more». */
export const previewRows = 50;

export type PriceKind = "percent" | "amount";
export type Direction = "up" | "down";
export type RoundMode = (typeof roundModes)[number];

export interface PriceForm {
  categoryId: string;
  status: string;
  tag: string;
  kind: PriceKind;
  direction: Direction;
  /** As typed: percent (may have up to two decimals) or Toman. */
  value: string;
  roundTo: number;
  roundMode: RoundMode;
}

export type PriceFormError = "value_required" | "percent_invalid" | "amount_invalid";

/** The typed value as a number (Persian digits and separators allowed), or null when it is not a number. */
export function parseValue(kind: PriceKind, text: string): number | null {
  const latin = toLatinDigits(text).replace(/[٬,\s]/g, "").replace("٫", ".");
  if (!latin) return null;
  if (kind === "amount") return /^\d+$/.test(latin) ? Number(latin) : null;
  return /^\d+(\.\d{1,2})?$/.test(latin) ? Number(latin) : null;
}

/** Builds the backend request from the form, or the reason it cannot be sent. An empty scope means every product. */
export function requestFromForm(f: PriceForm): { request: PriceChangeRequest } | { error: PriceFormError } {
  if (!f.value.trim()) return { error: "value_required" };
  const n = parseValue(f.kind, f.value);
  const sign = f.direction === "down" ? -1 : 1;
  const tag = f.tag.trim();
  const scope = { productIds: null, categoryId: f.categoryId || null, tag: tag || null, status: f.status || null, all: !f.categoryId && !tag && !f.status };
  const rounding = { roundTo: f.roundTo, roundMode: f.roundTo > 1 ? f.roundMode : "nearest", fingerprint: null };
  if (f.kind === "percent") {
    const percent = n === null ? null : sign * n;
    if (percent === null || percent === 0 || percent < percentLimits.min || percent > percentLimits.max) return { error: "percent_invalid" };
    return { request: { scope, kind: "percent", percent, amount: null, ...rounding } };
  }
  if (n === null || n === 0) return { error: "amount_invalid" };
  return { request: { scope, kind: "amount", percent: null, amount: { amount: sign * n * RIAL_PER_TOMAN, currency: "IRR" }, ...rounding } };
}

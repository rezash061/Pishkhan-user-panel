import type { Money } from "@/lib/api/types";
import { digitsOnly } from "@/lib/i18n/digits";

/** Backend money is Rial (`Money.amount`, int64); sellers think and type in Toman. One Toman = 10 Rial. */
export const RIAL_PER_TOMAN = 10;

/** 10 trillion Rial, the backend's `CatalogValidator.MaxPrice`. */
export const MAX_PRICE_RIAL = 10_000_000_000_000;

export function rialOf(money: Money | null | undefined): number | null {
  if (!money || money.amount === undefined || money.amount === null) return null;
  const n = Number(money.amount);
  return Number.isFinite(n) ? n : null;
}

export function tomanOf(money: Money | null | undefined): number | null {
  const rial = rialOf(money);
  return rial === null ? null : Math.round(rial / RIAL_PER_TOMAN);
}

export function moneyFromToman(toman: number | null): Money | null {
  return toman === null ? null : { amount: toman * RIAL_PER_TOMAN, currency: "IRR" };
}

/** Typed text (any digits, any separators) to a whole Toman amount, or null when empty. */
export function parseToman(text: string): number | null {
  const digits = digitsOnly(text);
  return digits ? Number(digits) : null;
}

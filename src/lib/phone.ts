import { digitsOnly } from "./i18n/digits";

/**
 * Normalizes an Iranian mobile number typed in any form (09…, 9…, +989…, 00989…, Persian or Arabic digits)
 * to the national form 09xxxxxxxxx, or returns null when it is not a valid mobile number.
 */
export function normalizeIranMobile(input: string): string | null {
  let digits = digitsOnly(input);
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return /^9\d{9}$/.test(digits) ? `0${digits}` : null;
}

/** 09121234567 → «۰۹۱۲ ۱۲۳ ۴۵۶۷» style grouping (Latin digits; wrap with toPersianDigits for display). */
export function groupMobile(national: string): string {
  return national.length === 11 ? `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}` : national;
}

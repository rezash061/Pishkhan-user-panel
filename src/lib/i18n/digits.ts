const persian = "۰۱۲۳۴۵۶۷۸۹";
const arabic = "٠١٢٣٤٥٦٧٨٩";

/** Latin digits to Persian digits, for display. Leaves every other character untouched. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => persian[Number(d)]!);
}

/** Persian and Arabic digits to Latin digits, for anything typed into an input before it is sent to the backend. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
}

/** Keeps only digits (any script), returned as Latin digits. */
export function digitsOnly(value: string): string {
  return toLatinDigits(value).replace(/[^0-9]/g, "");
}

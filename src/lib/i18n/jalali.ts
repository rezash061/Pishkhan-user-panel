import { getDate, getDaysInMonth, getMonth, getYear, newDate } from "date-fns-jalali";

export const jalaliMonths = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Jalali (year, month 1–12, day) → ISO calendar date "YYYY-MM-DD" (backend DateOnly). */
export function jalaliToIso(year: number, month: number, day: number): string {
  const d = newDate(year, month - 1, day);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO calendar date → Jalali parts. */
export function isoToJalali(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return { year: getYear(date), month: getMonth(date) + 1, day: getDate(date) };
}

export function jalaliDaysInMonth(year: number, month: number): number {
  return getDaysInMonth(newDate(year, month - 1, 1));
}

export function currentJalaliYear(now: Date = new Date()): number {
  return getYear(now);
}

/** Nowruz holidays (1–4 Farvardin) of a Jalali year, as ISO dates. */
export function nowruzDates(year: number): string[] {
  return [1, 2, 3, 4].map((day) => jalaliToIso(year, 1, day));
}

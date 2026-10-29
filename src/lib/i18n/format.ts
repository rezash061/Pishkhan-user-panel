import { differenceInSeconds } from "date-fns";
import { format as formatJalali, isSameDay } from "date-fns-jalali";
import { faIR } from "date-fns-jalali/locale";
import { toPersianDigits } from "./digits";

const tehran = "Asia/Tehran";

/** Wall-clock parts of an instant in Asia/Tehran, as a Date whose local fields hold them (for date-fns-jalali). */
export function inTehran(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tehran,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/** Jalali date, for example «۷ آبان ۱۴۰۵». */
export function formatDate(value: string | Date): string {
  return toPersianDigits(formatJalali(inTehran(value), "d MMMM yyyy", { locale: faIR }));
}

/** Jalali date and time, for example «۷ آبان ۱۴۰۵، ۱۴:۳۰». */
export function formatDateTime(value: string | Date): string {
  return toPersianDigits(formatJalali(inTehran(value), "d MMMM yyyy، HH:mm", { locale: faIR }));
}

/** Time of day in Tehran, for example «۱۴:۳۰». */
export function formatTime(value: string | Date): string {
  return toPersianDigits(formatJalali(inTehran(value), "HH:mm", { locale: faIR }));
}

/** Day label for message separators: «امروز», «دیروز» or the Jalali date. */
export function formatDayLabel(value: string | Date, now: Date = new Date()): string {
  const day = inTehran(value);
  const today = inTehran(now);
  if (isSameDay(day, today)) return "امروز";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(day, yesterday)) return "دیروز";
  return toPersianDigits(formatJalali(day, "EEEE d MMMM yyyy", { locale: faIR }));
}

/** Short relative time for list rows: «الان», «۵ دقیقه», «۳ ساعت», then the Jalali date. */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const seconds = differenceInSeconds(now, typeof value === "string" ? new Date(value) : value);
  if (seconds < 60) return "الان";
  if (seconds < 3600) return `${toPersianDigits(Math.floor(seconds / 60))} دقیقه`;
  if (seconds < 86_400) return `${toPersianDigits(Math.floor(seconds / 3600))} ساعت`;
  if (seconds < 7 * 86_400) return `${toPersianDigits(Math.floor(seconds / 86_400))} روز`;
  return toPersianDigits(formatJalali(inTehran(value), "d MMMM", { locale: faIR }));
}

/** Countdown such as «۲۳:۱۴» (hours:minutes) or «۴ روز». Returns null when the deadline has passed. */
export function formatCountdown(deadline: string | Date, now: Date = new Date()): string | null {
  const seconds = differenceInSeconds(typeof deadline === "string" ? new Date(deadline) : deadline, now);
  if (seconds <= 0) return null;
  if (seconds >= 2 * 86_400) return `${toPersianDigits(Math.floor(seconds / 86_400))} روز`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return toPersianDigits(`${hours}:${String(minutes).padStart(2, "0")}`);
}

const thousands = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

/** Formats a number with Persian digits and thousands separators. */
export function formatNumber(value: number): string {
  return thousands.format(value);
}

/** Rial amount (backend Money.amount) shown as Toman: «۱۲۵٬۰۰۰ تومان». */
export function formatToman(amountRial: number): string {
  return `${thousands.format(Math.round(amountRial / 10))} تومان`;
}

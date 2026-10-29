import { describe, expect, it } from "vitest";
import { digitsOnly, toLatinDigits, toPersianDigits } from "./digits";
import { formatCountdown, formatDate, formatDayLabel, formatToman } from "./format";
import { isoToJalali, jalaliDaysInMonth, jalaliToIso, nowruzDates } from "./jalali";

describe("digits", () => {
  it("converts Latin to Persian and back, including Arabic digits", () => {
    expect(toPersianDigits("09121234567")).toBe("۰۹۱۲۱۲۳۴۵۶۷");
    expect(toLatinDigits("۰۹۱۲ ٣٤٥")).toBe("0912 345");
    expect(digitsOnly("+۹۸ (۹۱۲) 000-11٢٢")).toBe("989120001122");
  });
});

describe("format", () => {
  it("shows Toman from Rial with Persian digits", () => {
    expect(formatToman(1_250_000)).toBe("۱۲۵٬۰۰۰ تومان");
  });

  it("formats Jalali dates in Tehran time", () => {
    // 2026-10-28 22:00 UTC is 29 October 01:30 in Tehran, which is 7 Aban 1405.
    expect(formatDate("2026-10-28T22:00:00Z")).toBe("۷ آبان ۱۴۰۵");
  });

  it("labels today and yesterday", () => {
    const now = new Date("2026-10-29T10:00:00Z");
    expect(formatDayLabel("2026-10-29T06:00:00Z", now)).toBe("امروز");
    expect(formatDayLabel("2026-10-28T06:00:00Z", now)).toBe("دیروز");
  });

  it("counts down the messaging window", () => {
    const now = new Date("2026-10-29T10:00:00Z");
    expect(formatCountdown("2026-10-29T13:05:30Z", now)).toBe("۳:۰۵");
    expect(formatCountdown("2026-11-02T10:00:00Z", now)).toBe("۴ روز");
    expect(formatCountdown("2026-10-29T09:00:00Z", now)).toBeNull();
  });
});

describe("jalali", () => {
  it("round-trips Jalali and ISO dates", () => {
    expect(jalaliToIso(1406, 1, 1)).toBe("2027-03-21");
    expect(isoToJalali("2026-10-29")).toEqual({ year: 1405, month: 8, day: 7 });
    expect(nowruzDates(1406)).toEqual(["2027-03-21", "2027-03-22", "2027-03-23", "2027-03-24"]);
  });

  it("knows month lengths", () => {
    expect(jalaliDaysInMonth(1405, 1)).toBe(31);
    expect(jalaliDaysInMonth(1405, 7)).toBe(30);
    expect(jalaliDaysInMonth(1405, 12)).toBe(29);
  });
});

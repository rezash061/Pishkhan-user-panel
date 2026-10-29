import { describe, expect, it } from "vitest";
import { keywordMatches, keywordVariants, matchKey, normalizePersian } from "./keywords";

// Cases copied from backend tests/Pishkhan.Persian.Tests/NormalizerTests.cs and tests/Pishkhan.UnitTests/AutomationTests.cs.
describe("normalizePersian (mirrors PersianNormalizer)", () => {
  it.each([
    ["علي", "علی"],
    ["كتاب", "کتاب"],
    ["مشكي", "مشکی"],
    ["مصطفى", "مصطفی"],
    ["مدرسة", "مدرسه"],
    ["خانۀ", "خانه"],
    ["أحمد", "احمد"],
    ["إيران", "ایران"],
    ["مؤسسه", "موسسه"],
    ["مسئول", "مسیول"],
    ["آرایشی", "آرایشی"],
    ["۰۹۱۲۰۰۰۱۲۳۴", "09120001234"],
    ["٠٩١٢٠٠٠١٢٣٤", "09120001234"],
    ["قیمت ۲۵۰ هزار", "قیمت 250 هزار"],
    ["۱۰۰۰", "1000"],
    ["۱۱۱۱", "1111"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePersian(input)).toBe(expected);
  });

  it("drops tatweel and collapses stretched letters", () => {
    expect(normalizePersian("ســـلام")).toBe("سلام");
    expect(normalizePersian("سلاااام")).toBe("سلاام");
  });

  it("keeps a half-space only between letters", () => {
    expect(normalizePersian("می‌خوام")).toBe("می‌خوام");
    expect(normalizePersian("می ‌خوام")).toBe("می خوام");
  });
});

describe("keywordMatches (mirrors KeywordMatcher)", () => {
  const rule = (match: string, keyword: string) => ({ match, keywords: [keyword] });

  it.each([
    ["exact", "قیمت", "قيمت"],
    ["contains", "کیف", "اين كيف چنده؟"],
    ["exact", "می‌خوام", "میخوام"],
    ["exact", "می‌خوام", "می خوام"],
    ["any_of", "می خوام", "سلام، میخوام سفارش بدم"],
    ["exact", "کد 25", "کد ۲۵"],
    ["contains", "25", "کد ٢٥ رو میخوام"],
    ["exact", "price", "PRICE!!! 😍"],
    ["exact", "قیمت", "قیمت؟"],
    ["exact", "سلام", "ســـلام"],
  ])("%s %s matches %s", (match, keyword, text) => {
    expect(keywordMatches(rule(match, keyword), text)).toBe(true);
  });

  it.each([
    ["exact", "قیمت", "قیمت چنده"],
    ["any_of", "کیف", "کیفیت خوبه"],
    ["contains", "تخفیف", "قیمت"],
    ["exact", "قیمت", ""],
  ])("%s %s does not match %s", (match, keyword, text) => {
    expect(keywordMatches(rule(match, keyword), text)).toBe(false);
  });

  it.each([
    ["قیمت*|price*", "قيمت اين چنده", true],
    ["*ارسال*", "هزینه ارسال به شیراز؟", true],
    ["*ارسال*", "قیمت", false],
    ["سایز ۳۸", "سایز 38", true],
  ])("pattern %s on %s → %s", (pattern, text, expected) => {
    expect(keywordMatches({ match: "pattern", pattern }, text)).toBe(expected);
  });

  it("treats punctuation and emoji as separators", () => {
    expect(matchKey("PRICE!!! 😍")).toBe("price");
  });
});

describe("keywordVariants", () => {
  it("shows Arabic-letter and spacing spellings that also match", () => {
    const variants = keywordVariants("می‌خوام");
    expect(variants).toContain("مي‌خوام");
    expect(variants).toContain("می خوام");
    expect(variants).toContain("میخوام");
    for (const v of variants) expect(keywordMatches({ match: "exact", keywords: ["می‌خوام"] }, v)).toBe(true);
  });

  it("offers Persian digits for Latin ones", () => {
    expect(keywordVariants("کد 25", 10)).toContain("کد ۲۵");
  });
});

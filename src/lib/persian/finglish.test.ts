import { describe, expect, it } from "vitest";
import { letterCounts, looksFinglish } from "./finglish";

describe("Finglish hint", () => {
  it("flags Persian written in Latin letters", () => {
    expect(looksFinglish("salam gheymatesh chande?")).toBe(true);
    expect(looksFinglish("Size M darid? 😍")).toBe(true);
    expect(looksFinglish("mersi, ersal be shiraz chand rooze?")).toBe(true);
  });

  it("leaves Persian script, emoji, digits and tiny texts alone", () => {
    expect(looksFinglish("سلام قیمتش چنده؟")).toBe(false);
    expect(looksFinglish("😍😍 ۱۲۳ 456")).toBe(false);
    expect(looksFinglish("ok")).toBe(false);
    expect(looksFinglish("")).toBe(false);
    expect(looksFinglish(null)).toBe(false);
  });

  it("needs at least 70% Latin among letters", () => {
    // 7 Latin, 3 Persian letters: exactly 70%.
    expect(letterCounts("abcdefg سلا")).toEqual([7, 3]);
    expect(looksFinglish("abcdefg سلا")).toBe(true);
    expect(looksFinglish("abcdef سلام")).toBe(false);
    expect(looksFinglish("قیمت این مانتو چنده؟ size L")).toBe(false);
  });

  it("ignores links and handles", () => {
    expect(looksFinglish("این مدل رو دارید؟ https://instagram.com/p/abc123")).toBe(false);
    expect(looksFinglish("@niloo.gallery سلام")).toBe(false);
  });
});

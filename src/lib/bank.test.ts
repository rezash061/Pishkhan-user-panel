import { describe, expect, it } from "vitest";
import { cleanCard, cleanSheba, formatCard, isValidCard, isValidSheba } from "./bank";

describe("bank card", () => {
  it("accepts a Luhn-valid card typed in any digits with separators", () => {
    expect(isValidCard("6037 9912 3456 7893")).toBe(true);
    expect(isValidCard("۶۰۳۷-۹۹۱۲-۳۴۵۶-۷۸۹۳")).toBe(true);
    expect(cleanCard("۶۰۳۷ ۹۹۱۲ ۳۴۵۶ ۷۸۹۳")).toBe("6037991234567893");
  });

  it("rejects a wrong check digit or length", () => {
    expect(isValidCard("6037991234567894")).toBe(false);
    expect(isValidCard("603799123456789")).toBe(false);
  });

  it("formats in groups of four", () => expect(formatCard("6037991234567893")).toBe("6037-9912-3456-7893"));
});

describe("sheba", () => {
  it("accepts a mod-97 valid Sheba with or without IR", () => {
    expect(isValidSheba("IR820540102680020817909002")).toBe(true);
    expect(isValidSheba("820540102680020817909002")).toBe(true);
    expect(isValidSheba("ir82 0540 1026 8002 0817 9090 02")).toBe(true);
    expect(cleanSheba("۸۲۰۵۴۰۱۰۲۶۸۰۰۲۰۸۱۷۹۰۹۰۰۲")).toBe("IR820540102680020817909002");
  });

  it("rejects a wrong checksum or shape", () => {
    expect(isValidSheba("IR820540102680020817909003")).toBe(false);
    expect(isValidSheba("IR8205401026800208179090")).toBe(false);
  });
});

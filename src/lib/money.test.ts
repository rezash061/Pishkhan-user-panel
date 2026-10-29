import { describe, expect, it } from "vitest";
import { moneyFromToman, parseToman, tomanOf } from "./money";

describe("money", () => {
  it("converts Toman to backend Rial and back", () => {
    expect(moneyFromToman(890_000)).toEqual({ amount: 8_900_000, currency: "IRR" });
    expect(tomanOf({ amount: 8_900_000, currency: "IRR" })).toBe(890_000);
    expect(tomanOf({ amount: "8900000", currency: "IRR" })).toBe(890_000);
    expect(tomanOf(null)).toBeNull();
  });

  it("parses Persian digits and separators", () => {
    expect(parseToman("۸۹۰٬۰۰۰")).toBe(890_000);
    expect(parseToman("1,250,000")).toBe(1_250_000);
    expect(parseToman("")).toBeNull();
  });
});

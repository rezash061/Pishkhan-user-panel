import { describe, expect, it } from "vitest";
import { parseValue, requestFromForm, type PriceForm } from "./price-rule";

const form = (over: Partial<PriceForm> = {}): PriceForm => ({ categoryId: "", status: "", tag: "", kind: "percent", direction: "up", value: "10", roundTo: 1000, roundMode: "up", ...over });

describe("bulk price form", () => {
  it("reads Persian digits, separators and the Persian decimal point", () => {
    expect(parseValue("percent", "۱۲٫۵")).toBe(12.5);
    expect(parseValue("amount", "۵۰٬۰۰۰")).toBe(50_000);
    expect(parseValue("amount", "12.5")).toBeNull();
    expect(parseValue("percent", "1.234")).toBeNull();
  });

  it("means every product when no category, status or tag is picked", () => {
    const r = requestFromForm(form());
    expect("request" in r && r.request.scope).toEqual({ productIds: null, categoryId: null, tag: null, status: null, all: true });
  });

  it("lowers by a percent with a negative value and keeps the rounding", () => {
    const r = requestFromForm(form({ direction: "down", value: "15", categoryId: "c1" }));
    expect("request" in r && r.request).toMatchObject({ kind: "percent", percent: -15, amount: null, roundTo: 1000, roundMode: "up", scope: { categoryId: "c1", all: false } });
  });

  it("sends a Toman amount as Rial", () => {
    const r = requestFromForm(form({ kind: "amount", direction: "down", value: "۲۰۰۰۰", roundTo: 1 }));
    expect("request" in r && r.request).toMatchObject({ kind: "amount", percent: null, amount: { amount: -200_000, currency: "IRR" }, roundMode: "nearest" });
  });

  it("refuses an empty value, zero and percents out of range", () => {
    expect(requestFromForm(form({ value: " " }))).toEqual({ error: "value_required" });
    expect(requestFromForm(form({ value: "0" }))).toEqual({ error: "percent_invalid" });
    expect(requestFromForm(form({ direction: "down", value: "95" }))).toEqual({ error: "percent_invalid" });
    expect(requestFromForm(form({ value: "501" }))).toEqual({ error: "percent_invalid" });
    expect(requestFromForm(form({ kind: "amount", value: "0" }))).toEqual({ error: "amount_invalid" });
  });
});

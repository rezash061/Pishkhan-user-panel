import { describe, expect, it } from "vitest";
import { combinations, optionsFromVariants, syncRows, variantRequest } from "./variants";

describe("variant matrix", () => {
  it("builds every size × colour combination", () => {
    const combos = combinations([
      { name: "سایز", values: ["M", "L"] },
      { name: "رنگ", values: ["مشکی", "کرم"] },
    ]);
    expect(combos).toHaveLength(4);
    expect(combos[0]).toEqual({ سایز: "M", رنگ: "مشکی" });
  });

  it("keeps typed prices and ids when an option value is added", () => {
    const first = syncRows([{ name: "سایز", values: ["M"] }], [], { stockPolicy: "track" });
    first[0] = { ...first[0]!, id: "v1", price: 890_000, stock: 3 };
    const next = syncRows([{ name: "سایز", values: ["M", "L"] }], first, { stockPolicy: "track" });
    expect(next[0]).toMatchObject({ id: "v1", price: 890_000, stock: 3 });
    expect(next[1]).toMatchObject({ id: null, price: null, stock: 0 });
  });

  it("reads options back from stored variants", () => {
    const variants = [
      { id: "a", sku: null, attributes: { سایز: "M", رنگ: "مشکی" }, price: null, effectivePrice: null, stock: 1, stockPolicy: "track", inStock: true },
      { id: "b", sku: null, attributes: { سایز: "L", رنگ: "مشکی" }, price: null, effectivePrice: null, stock: 0, stockPolicy: "track", inStock: false },
    ];
    expect(optionsFromVariants(variants)).toEqual([
      { name: "سایز", values: ["M", "L"] },
      { name: "رنگ", values: ["مشکی"] },
    ]);
  });

  it("sends Rial prices and no stock for unlimited rows", () => {
    expect(variantRequest({ id: null, attributes: {}, sku: " SKU-1 ", price: 100_000, stockPolicy: "unlimited", stock: 5 })).toEqual({
      id: null,
      sku: "SKU-1",
      attributes: {},
      price: { amount: 1_000_000, currency: "IRR" },
      stock: null,
      stockPolicy: "unlimited",
    });
  });
});

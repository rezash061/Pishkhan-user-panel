import type { Variant, VariantRequest } from "@/lib/api/types";
import { moneyFromToman, tomanOf } from "@/lib/money";

/** An option such as «سایز: S، M، L». Up to 5 per product (backend `MaxAttributes`). */
export interface ProductOption {
  name: string;
  values: string[];
}

/** One row of the variants matrix, prices in Toman. */
export interface VariantRow {
  id: string | null;
  attributes: Record<string, string>;
  sku: string;
  price: number | null;
  stockPolicy: "track" | "unlimited";
  stock: number | null;
}

export const MAX_OPTIONS = 5;
export const MAX_VARIANTS = 100;

export const rowKey = (attributes: Record<string, string>) =>
  Object.keys(attributes)
    .sort()
    .map((k) => `${k}=${attributes[k]}`)
    .join("|");

export function rowFromVariant(v: Variant): VariantRow {
  return {
    id: v.id,
    attributes: v.attributes,
    sku: v.sku ?? "",
    price: tomanOf(v.price),
    stockPolicy: v.stockPolicy === "track" ? "track" : "unlimited",
    stock: v.stock === null || v.stock === undefined ? null : Number(v.stock),
  };
}

/** Options as they appear in stored variants (key order and value order of first appearance). */
export function optionsFromVariants(variants: Variant[]): ProductOption[] {
  const options: ProductOption[] = [];
  for (const v of variants) {
    for (const [name, value] of Object.entries(v.attributes)) {
      let option = options.find((o) => o.name === name);
      if (!option) options.push((option = { name, values: [] }));
      if (!option.values.includes(value)) option.values.push(value);
    }
  }
  return options;
}

/** Every combination of the options' values (cartesian product). Options without a name or values are ignored. */
export function combinations(options: ProductOption[]): Record<string, string>[] {
  const usable = options.filter((o) => o.name.trim() && o.values.length);
  if (!usable.length) return [];
  return usable.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((combo) => o.values.map((v) => ({ ...combo, [o.name.trim()]: v }))), [{}]);
}

/** Rebuilds the matrix for new options, keeping what the seller already typed for rows that still exist. */
export function syncRows(options: ProductOption[], current: VariantRow[], defaults: Pick<VariantRow, "stockPolicy">): VariantRow[] {
  const byKey = new Map(current.map((r) => [rowKey(r.attributes), r]));
  return combinations(options)
    .slice(0, MAX_VARIANTS)
    .map((attributes) => byKey.get(rowKey(attributes)) ?? { id: null, attributes, sku: "", price: null, stockPolicy: defaults.stockPolicy, stock: defaults.stockPolicy === "track" ? 0 : null });
}

export function variantRequest(r: VariantRow): VariantRequest {
  return {
    id: r.id,
    sku: r.sku.trim() || null,
    attributes: r.attributes,
    price: moneyFromToman(r.price),
    stock: r.stockPolicy === "track" ? (r.stock ?? 0) : null,
    stockPolicy: r.stockPolicy,
  };
}

export const variantLabel = (attributes: Record<string, string>) => Object.values(attributes).join(" / ");

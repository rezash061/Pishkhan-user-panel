import type { Overage } from "@/lib/api/types";
import { rialOf } from "@/lib/money";

/** Overage states (backend `OverageStates`). */
export const overageStates = ["within", "overage", "plan_limit", "overage_cap", "overage_unpaid"] as const;
export type OverageState = (typeof overageStates)[number];

/** The cap may be 0 to 10× the plan's monthly price (at least Zarinpal's 10,000 Rial), backend `OverageEndpoints`. */
export const MAX_CAP_MULTIPLE = 10;
const MIN_PRICE_RIAL = 10_000;

export function maxCapRial(monthlyRial: number | null | undefined): number {
  return Math.max(monthlyRial ?? 0, MIN_PRICE_RIAL) * MAX_CAP_MULTIPLE;
}

export function capValid(capRial: number | null, monthlyRial: number | null | undefined): boolean {
  return capRial === null || (Number.isInteger(capRial) && capRial >= 0 && capRial <= maxCapRial(monthlyRial));
}

/** Share of the cap spent so far (0–1), or null when there is no cap to compare with. */
export function capShare(o: Pick<Overage, "amount" | "cap">): number | null {
  const cap = rialOf(o.cap) ?? 0;
  if (cap <= 0) return null;
  return Math.min(1, (rialOf(o.amount) ?? 0) / cap);
}

/** Included conversations used (0–1), or null when the plan has no limit. */
export function includedShare(o: Pick<Overage, "used" | "included">): number | null {
  if (o.included === null || o.included === undefined) return null;
  if (o.included <= 0) return o.used > 0 ? 1 : 0;
  return Math.min(1, o.used / o.included);
}

/** States in which new AI conversations go to a person instead. */
export const refusing = (state: string) => state === "plan_limit" || state === "overage_cap" || state === "overage_unpaid";

/** The PUT body: `cap` null keeps the default (the plan's monthly price). */
export function overageRequest(enabled: boolean, capMode: "default" | "custom", capToman: number | null): { enabled: boolean; cap: number | null } {
  return { enabled, cap: capMode === "default" || capToman === null ? null : capToman * 10 };
}

export const hasDue = (o: Pick<Overage, "due"> | undefined) => (rialOf(o?.due) ?? 0) > 0;

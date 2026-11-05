import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fa.json";
import { capShare, capValid, hasDue, includedShare, maxCapRial, overageRequest, overageStates, refusing } from "./overage-model";

const rial = (amount: number) => ({ amount, currency: "IRR" as const });

describe("overage", () => {
  it("caps at 10× the monthly price, at least 10× Zarinpal's minimum", () => {
    expect(maxCapRial(8_900_000)).toBe(89_000_000);
    expect(maxCapRial(0)).toBe(100_000);
    expect(maxCapRial(null)).toBe(100_000);
    expect(capValid(null, 8_900_000)).toBe(true);
    expect(capValid(0, 8_900_000)).toBe(true);
    expect(capValid(89_000_000, 8_900_000)).toBe(true);
    expect(capValid(89_000_010, 8_900_000)).toBe(false);
    expect(capValid(-10, 8_900_000)).toBe(false);
  });

  it("sends the cap in Rial, or null for the default", () => {
    expect(overageRequest(true, "default", 500_000)).toEqual({ enabled: true, cap: null });
    expect(overageRequest(true, "custom", 500_000)).toEqual({ enabled: true, cap: 5_000_000 });
    expect(overageRequest(false, "custom", null)).toEqual({ enabled: false, cap: null });
  });

  it("measures the included conversations and the cap", () => {
    expect(includedShare({ used: 450, included: 1000 })).toBe(0.45);
    expect(includedShare({ used: 1200, included: 1000 })).toBe(1);
    expect(includedShare({ used: 3, included: null })).toBeNull();
    expect(capShare({ amount: rial(2_000_000), cap: rial(8_000_000) })).toBe(0.25);
    expect(capShare({ amount: rial(1), cap: rial(0) })).toBeNull();
  });

  it("knows when new conversations go to the team, and when something is owed", () => {
    expect(["within", "overage", "plan_limit", "overage_cap", "overage_unpaid"].map(refusing)).toEqual([false, false, true, true, true]);
    expect(hasDue({ due: rial(10_000) })).toBe(true);
    expect(hasDue({ due: rial(0) })).toBe(false);
    expect(hasDue(undefined)).toBe(false);
  });

  it("has Persian text for every state, error and handoff reason", () => {
    const t = createTranslator({ locale: "fa", messages });
    for (const s of overageStates) {
      expect(t.has(`billing.overage.states.${s}` as never), s).toBe(true);
      expect(t.has(`billing.overage.stateHints.${s}` as never), s).toBe(true);
    }
    for (const k of ["billing.overage.cap_invalid", "billing.overage.checkout_pending", "billing.overage.nothing_due", "billing.checkout.unavailable", "billing.checkout.gateway_unavailable"]) expect(t.has(`errors.${k}` as never), k).toBe(true);
    for (const r of ["plan_limit", "overage_cap", "overage_unpaid"]) expect(t.has(`inbox.handoff.reasons.ai.${r}` as never), r).toBe(true);
    expect(t.has("notifications.prefs.kinds.billing" as never)).toBe(true);
  });
});

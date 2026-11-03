import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fa.json";
import type { BillingPlanOption, CurrentPlan, PublicPlan, Subscription } from "@/lib/api/types";
import {
  annualSaving,
  checkoutErrorCodes,
  checkoutKinds,
  checkoutReturnPath,
  cycleFor,
  cyclesOf,
  initialCycle,
  offersAnnual,
  outcomeOf,
  planName,
  priceOf,
  subscriptionOf,
  toneOf,
} from "./checkout";

const rial = (toman: number) => ({ amount: toman * 10, currency: "IRR" as const });

// Realistic plans as GET /billing/plans returns them (prices in Rial).
const plan = (over: Partial<PublicPlan> = {}): PublicPlan => ({
  id: "0199c000-0000-7000-8000-000000000002",
  code: "growth",
  name: "رشد",
  tagline: "برای فروشگاه‌های در حال رشد",
  description: null,
  monthly: rial(890_000),
  annual: rial(8_900_000),
  aiConversations: 1000,
  overagePerConversation: rial(500),
  channelAccounts: 2,
  seats: 5,
  highlighted: true,
  isFree: false,
  limits: {},
  features: [],
  ...over,
});
const free = plan({ id: "0199c000-0000-7000-8000-000000000001", code: "free", name: "رایگان", monthly: rial(0), annual: null, isFree: true, highlighted: false });
const option = (p: PublicPlan, over: Partial<BillingPlanOption> = {}): BillingPlanOption => ({ plan: p, current: false, kind: "new", unavailable: null, ...over });

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: "0199d000-0000-7000-8000-000000000001",
  planId: "0199c000-0000-7000-8000-000000000002",
  planCode: "growth",
  planVersion: 1,
  state: "active",
  trial: false,
  startsAt: "2026-10-01T08:00:00Z",
  endsAt: "2026-10-31T08:00:00Z",
  endedAt: null,
  endReason: null,
  cycle: "monthly",
  checkoutId: null,
  ...over,
});
const currentPlan = (over: Partial<CurrentPlan> = {}): CurrentPlan => ({
  source: "subscription",
  planId: null,
  planCode: "growth",
  planName: "رشد",
  planVersion: 1,
  trial: false,
  endsAt: null,
  limits: {},
  subscription: sub(),
  upcoming: [],
  ...over,
});

describe("plan prices and cycles", () => {
  it("reads Rial prices and treats zero or missing as not sold", () => {
    expect(priceOf(plan(), "monthly")).toBe(8_900_000);
    expect(priceOf(plan(), "annual")).toBe(89_000_000);
    expect(priceOf(free, "monthly")).toBeNull();
    expect(priceOf(free, "annual")).toBeNull();
  });

  it("falls back to the only cycle a plan is sold for", () => {
    const annualOnly = plan({ monthly: rial(0) });
    expect(cyclesOf(annualOnly)).toEqual(["annual"]);
    expect(cycleFor(annualOnly, "monthly")).toBe("annual");
    expect(cycleFor(plan({ annual: null }), "annual")).toBe("monthly");
    expect(cycleFor(plan(), "annual")).toBe("annual");
    expect(cycleFor(free, "monthly")).toBeNull();
  });

  it("works out the annual saving against twelve months", () => {
    // 8.9M a year against 12 × 890k = 10.68M: 17% off.
    expect(annualSaving(plan())).toBe(17);
    expect(annualSaving(plan({ annual: rial(890_000 * 12) }))).toBeNull();
    expect(annualSaving(plan({ annual: null }))).toBeNull();
  });

  it("shows the cycle toggle only when some plan has an annual price", () => {
    expect(offersAnnual([option(free), option(plan())])).toBe(true);
    expect(offersAnnual([option(free), option(plan({ annual: null }))])).toBe(false);
  });

  it("starts on the cycle the current subscription was bought with", () => {
    expect(initialCycle(undefined)).toBe("monthly");
    expect(initialCycle(currentPlan({ subscription: sub({ cycle: "annual" }) }))).toBe("annual");
    expect(initialCycle(currentPlan({ subscription: null }))).toBe("monthly");
  });
});

describe("checkout outcome", () => {
  it("tells a cancelled payment from a failed one", () => {
    expect(outcomeOf({ status: "paid", error: null })).toBe("paid");
    expect(outcomeOf({ status: "failed", error: "cancelled" })).toBe("cancelled");
    expect(outcomeOf({ status: "failed", error: "-51" })).toBe("failed");
    expect(outcomeOf({ status: "expired", error: null })).toBe("expired");
    expect(outcomeOf({ status: "pending", error: null })).toBe("pending");
  });

  it("colours every status, unknown ones neutral", () => {
    expect(["paid", "pending", "failed", "expired", "refunded"].map(toneOf)).toEqual(["success", "warning", "danger", "neutral", "neutral"]);
  });

  it("finds the subscription a checkout bought, current or upcoming", () => {
    const checkoutId = "0199e000-0000-7000-8000-000000000001";
    const later = sub({ id: "0199d000-0000-7000-8000-000000000002", state: "scheduled", checkoutId, startsAt: "2026-10-31T08:00:00Z" });
    const c = currentPlan({ upcoming: [later] });
    expect(subscriptionOf(c, { id: checkoutId, subscriptionId: null })).toBe(later);
    expect(subscriptionOf(c, { id: "x", subscriptionId: c.subscription!.id })).toBe(c.subscription);
    expect(subscriptionOf(c, { id: "x", subscriptionId: "y" })).toBeNull();
    expect(subscriptionOf(undefined, { id: checkoutId, subscriptionId: null })).toBeNull();
  });

  it("names a plan by its code, or shows the code", () => {
    expect(planName([option(plan())], "growth")).toBe("رشد");
    expect(planName([option(plan())], "pro")).toBe("pro");
  });
});

describe("checkout return", () => {
  const ws = "0199b000-0000-7000-8000-0000000000aa";
  const id = "0199e000-0000-7000-8000-000000000001";

  it("opens the checkout in the workspace that started it", () => {
    expect(checkoutReturnPath(ws, id, "paid")).toBe(`/w/${ws}/billing/checkouts/${id}?status=paid`);
    expect(checkoutReturnPath(ws, id, "pending")).toBe(`/w/${ws}/billing/checkouts/${id}?status=pending`);
    expect(checkoutReturnPath(ws, id, "bogus")).toBe(`/w/${ws}/billing/checkouts/${id}`);
  });

  it("falls back to the billing page or the workspace list", () => {
    expect(checkoutReturnPath(ws, "../../admin", "paid")).toBe(`/w/${ws}/billing`);
    expect(checkoutReturnPath(ws, undefined, undefined)).toBe(`/w/${ws}/billing`);
    expect(checkoutReturnPath("evil.example", id, "paid")).toBe("/workspaces");
    expect(checkoutReturnPath(undefined, id, "paid")).toBe("/workspaces");
  });
});

describe("Persian messages", () => {
  const t = createTranslator({ locale: "fa", messages });

  it("translates every BE-2.8 error code", () => {
    for (const code of checkoutErrorCodes) expect(t.has(`errors.${code}` as never), code).toBe(true);
  });

  it("names every kind and status", () => {
    for (const kind of checkoutKinds) {
      for (const group of ["action", "kind", "kindHint"]) expect(t.has(`billing.plans.${group}.${kind}` as never), `${group}.${kind}`).toBe(true);
    }
    for (const status of ["pending", "paid", "failed", "expired"]) expect(t.has(`billing.history.statuses.${status}` as never)).toBe(true);
    for (const outcome of ["paid", "failed", "cancelled", "expired", "pending"]) expect(t.has(`billing.result.${outcome}` as never)).toBe(true);
  });
});

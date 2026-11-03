import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fa.json";
import facts from "../../../tests/mock-api/fixtures/required-facts.json";
import type { FactStatus } from "@/lib/api/types";
import { bandOf, gaugeShare, missingFacts, nextFact, suggestionHref } from "./score";

const fact = (key: string, covered = false): FactStatus => ({ key, label: key, prompt: `${key}؟`, covered, sourceId: covered ? "s" : null });

describe("knowledge score", () => {
  it("bands the score and clamps the gauge", () => {
    expect([0, 39, 40, 74, 75, 100].map(bandOf)).toEqual(["low", "low", "mid", "mid", "high", "high"]);
    expect(gaugeShare(-5)).toBe(0);
    expect(gaugeShare(46)).toBe(0.46);
    expect(gaugeShare(130)).toBe(1);
  });

  it("links every backend suggestion to its page", () => {
    const ws = "w1";
    expect(suggestionHref("knowledge.suggest.answer_facts", ws)).toBe("/w/w1/knowledge/interview");
    expect(suggestionHref("knowledge.suggest.add_faqs", ws)).toBe("/w/w1/knowledge");
    expect(suggestionHref("knowledge.suggest.add_products", ws)).toBe("/w/w1/catalog/products/new");
    expect(suggestionHref("knowledge.suggest.add_prices", ws)).toBe("/w/w1/catalog");
    expect(suggestionHref("knowledge.suggest.add_stock", ws)).toBe("/w/w1/catalog");
    expect(suggestionHref("knowledge.suggest.answer_unanswered", ws)).toBe("/w/w1/knowledge/unanswered");
    expect(suggestionHref("knowledge.suggest.something_new", ws)).toBeNull();
  });

  it("asks the missing facts in order and moves past skipped ones", () => {
    const list = [fact("shipping_cost"), fact("payment_methods"), fact("shipping_time", true)];
    expect(missingFacts({ facts: list }).map((f) => f.key)).toEqual(["shipping_cost", "payment_methods"]);
    expect(nextFact(list, [])?.key).toBe("shipping_cost");
    expect(nextFact(list, ["shipping_cost"])?.key).toBe("payment_methods");
    expect(nextFact(list, ["shipping_cost", "payment_methods"])).toBeNull();
    expect(nextFact([fact("a", true)], [])).toBeNull();
  });

  it("has Persian text for every suggestion, part, band and fact_unknown", () => {
    const t = createTranslator({ locale: "fa", messages });
    for (const s of ["answer_facts", "add_faqs", "add_products", "add_prices", "add_stock", "answer_unanswered"]) expect(t.has(`knowledge.score.suggest.${s}` as never), s).toBe(true);
    for (const p of ["facts", "products", "unanswered"]) expect(t.has(`knowledge.score.parts.${p}` as never)).toBe(true);
    for (const b of ["low", "mid", "high"]) expect(t.has(`knowledge.score.bands.${b}` as never)).toBe(true);
    expect(t.has("errors.knowledge.fact_unknown" as never)).toBe(true);
    expect(t("knowledge.interview.draftedAi" as never)).toBe("هوش مصنوعی پیش‌نویس کرد");
    expect(t("knowledge.interview.draftedOwn" as never)).toBe("از متن خودتان");
  });

  it("fixtures are the backend seeds' required facts", () => {
    expect(Object.keys(facts)).toEqual(["clothing", "cosmetics", "jewelry", "beauty_clinic", "courses"]);
    expect(facts.clothing.map((f) => f.key)).toContain("shipping_cost");
    expect(Object.values(facts).every((list) => list.every((f) => f.label && f.prompt))).toBe(true);
  });
});

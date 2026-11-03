import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fa.json";
import fixtures from "../../../tests/mock-api/fixtures/industry-templates.json";
import type { TemplateSummary } from "@/lib/api/types";
import { orderTemplates, resultLines } from "./model";

const summary = (industry: string, recommended = false): TemplateSummary => ({
  id: industry, industry, version: 1, name: industry, description: null, requiredFacts: 8, faqs: 8, flows: 1, rules: 3, hasAgentProfile: true, recommended, lastApplied: null,
});

describe("industry templates", () => {
  it("puts the workspace's own industry first and keeps the rest in order", () => {
    const list = [summary("clothing"), summary("jewelry", true), summary("courses")];
    expect(orderTemplates(list).map((x) => x.industry)).toEqual(["jewelry", "clothing", "courses"]);
  });

  it("lists only what an apply added, and what it left alone", () => {
    expect(resultLines({ faqsAdded: 8, flowsAdded: 1, rulesAdded: 3, profileApplied: true, skipped: 0 })).toEqual([["faqs", 8], ["flows", 1], ["rules", 3], ["profile", 1]]);
    expect(resultLines({ faqsAdded: 0, flowsAdded: 0, rulesAdded: 1, profileApplied: false, skipped: 11 })).toEqual([["rules", 1], ["skipped", 11]]);
    expect(resultLines({ faqsAdded: 0, flowsAdded: 0, rulesAdded: 0, profileApplied: false, skipped: 12 })).toEqual([["nothing", 0], ["skipped", 12]]);
  });

  it("has a Persian label for every result line, rule trigger and agent tone in the seeds", () => {
    const t = createTranslator({ locale: "fa", messages });
    for (const key of ["faqs", "flows", "rules", "profile", "nothing", "skipped"]) expect(t.has(`templates.result.${key}` as never)).toBe(true);
    for (const x of fixtures) {
      for (const r of x.rules) expect(t.has(`automations.triggers.${r.triggerKind}` as never), r.triggerKind).toBe(true);
      if (x.agentProfile) expect(t.has(`agent.settings.tones.${x.agentProfile.tone}` as never), x.agentProfile.tone).toBe(true);
    }
  });

  it("fixtures follow the backend seeds: blanks for the owner to fill", () => {
    expect(fixtures.map((x) => x.industry)).toEqual(["clothing", "cosmetics", "jewelry", "beauty_clinic", "courses"]);
    expect(fixtures.every((x) => x.faqs.some((f) => /\[[^\]]+\]/.test(f.answer)))).toBe(true);
  });
});

import type { FactStatus, KnowledgeScore } from "@/lib/api/types";

/** Score bands for the gauge: under 40 needs work, under 75 is getting there, 75+ is ready. */
export type ScoreBand = "low" | "mid" | "high";

export function bandOf(score: number): ScoreBand {
  if (score >= 75) return "high";
  return score >= 40 ? "mid" : "low";
}

/** Clamped 0–100 share for the gauge arc. */
export function gaugeShare(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score))) / 100;
}

/** Facts still missing, in the backend's order (missing ones come first there). */
export function missingFacts(score: Pick<KnowledgeScore, "facts"> | undefined): FactStatus[] {
  return (score?.facts ?? []).filter((f) => !f.covered);
}

/** The panel page a suggestion leads to (`knowledge.suggest.*`). Unknown keys lead nowhere. */
export function suggestionHref(key: string, ws: string): string | null {
  const base = `/w/${ws}`;
  switch (key.replace(/^knowledge\.suggest\./, "")) {
    case "answer_facts":
      return `${base}/knowledge/interview`;
    case "add_faqs":
      return `${base}/knowledge`;
    case "add_products":
      return `${base}/catalog/products/new`;
    case "add_prices":
    case "add_stock":
      return `${base}/catalog`;
    case "answer_unanswered":
      return `${base}/knowledge/unanswered`;
    default:
      return null;
  }
}

/** The fact the interview asks now: the first missing one not skipped this session, or null when none is left. */
export function nextFact(facts: FactStatus[], skipped: readonly string[]): FactStatus | null {
  const missing = facts.filter((f) => !f.covered);
  return missing.find((f) => !skipped.includes(f.key)) ?? null;
}

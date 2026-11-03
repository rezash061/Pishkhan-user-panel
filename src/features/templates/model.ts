import type { TemplateApplication, TemplateSummary } from "@/lib/api/types";

/** The recommended template (the workspace's own industry) first, the rest in the backend's order. */
export function orderTemplates(list: TemplateSummary[]): TemplateSummary[] {
  return [...list.filter((x) => x.recommended), ...list.filter((x) => !x.recommended)];
}

export type ResultLine = "faqs" | "flows" | "rules" | "profile" | "nothing" | "skipped";

/** The lines of «what was added» after an apply: only non-zero counts, the profile when it was set, and what was left alone. */
export function resultLines(r: Pick<TemplateApplication, "faqsAdded" | "flowsAdded" | "rulesAdded" | "profileApplied" | "skipped">): [ResultLine, number][] {
  const lines: [ResultLine, number][] = [];
  if (r.faqsAdded) lines.push(["faqs", r.faqsAdded]);
  if (r.flowsAdded) lines.push(["flows", r.flowsAdded]);
  if (r.rulesAdded) lines.push(["rules", r.rulesAdded]);
  if (r.profileApplied) lines.push(["profile", 1]);
  if (lines.length === 0) lines.push(["nothing", 0]);
  if (r.skipped) lines.push(["skipped", r.skipped]);
  return lines;
}

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fa.json";
import { addNode, handlesFor, nodeDefaults } from "@/features/flows/model";
import { flowNodeTypes } from "@/lib/api/types";
import { followUpReasons, followUpStatuses } from "./followups-data";
import { allowedActions, emptyMessage, followUpDelayValid, followUpSeconds, newAction, splitFollowUpDelay } from "./model";
import { emptyRuleForm, ruleProblems, ruleRequestFromForm, type RuleForm } from "./rule-form";

const followUp = (over = {}) => ({ ...newAction("schedule_followup"), message: { text: "هنوز به این مدل فکر می‌کنی؟" }, ...over });
const form = (over: Partial<RuleForm> = {}): RuleForm => ({ ...emptyRuleForm("dm_keyword"), name: "پیگیری قیمت", keywords: ["قیمت"], actions: [followUp()], ...over });

describe("schedule_followup", () => {
  it("starts at one hour with both cancels on", () => {
    expect(newAction("schedule_followup")).toEqual({ kind: "schedule_followup", message: emptyMessage(), delaySeconds: 3600, cancelOnReply: true, cancelOnPurchase: true });
  });

  it("keeps the delay between 1 minute and 23 hours", () => {
    expect(followUpDelayValid(59)).toBe(false);
    expect(followUpDelayValid(60)).toBe(true);
    expect(followUpDelayValid(82_800)).toBe(true);
    expect(followUpDelayValid(82_801)).toBe(false);
    expect(followUpSeconds(0, "minutes")).toBe(60);
    expect(followUpSeconds(30, "hours")).toBe(82_800);
    expect(followUpSeconds(90, "minutes")).toBe(5_400);
    expect(splitFollowUpDelay(7_200)).toEqual({ amount: 2, unit: "hours" });
    expect(splitFollowUpDelay(5_400)).toEqual({ amount: 90, unit: "minutes" });
  });

  it("is for DM rules only: a commenter has no conversation yet", () => {
    expect(allowedActions("dm_keyword")).toContain("schedule_followup");
    expect(allowedActions("comment_keyword")).not.toContain("schedule_followup");
    expect(ruleProblems(form({ triggerKind: "comment_keyword" }))["actions[0]"]).toBe("automation.action_needs_conversation");
  });

  it("checks the message, the delay and one per rule, like the backend", () => {
    expect(ruleProblems(form())).toEqual({});
    expect(ruleProblems(form({ actions: [followUp({ delaySeconds: 90_000 })] }))["actions[0].delaySeconds"]).toBe("automation.followup_delay_invalid");
    expect(ruleProblems(form({ actions: [followUp({ message: { text: " " } })] }))["actions[0].message"]).toBe("automation.message.empty");
    expect(ruleProblems(form({ actions: [followUp(), followUp()] })).actions).toBe("automation.one_followup");
  });

  it("sends every follow-up field", () => {
    const request = ruleRequestFromForm(form({ actions: [followUp({ delaySeconds: 1_800, cancelOnPurchase: false })] }));
    expect(request.actions?.[0]).toEqual({ kind: "schedule_followup", message: { text: "هنوز به این مدل فکر می‌کنی؟" }, delaySeconds: 1_800, cancelOnReply: true, cancelOnPurchase: false });
  });
});

describe("follow_gate node", () => {
  it("is in the palette with a true and a false exit", () => {
    expect(flowNodeTypes).toContain("follow_gate");
    expect(handlesFor("follow_gate")).toEqual(["true", "false"]);
    expect(nodeDefaults("follow_gate", "g")).toEqual({ id: "g", type: "follow_gate", message: { text: "" }, retryText: null, maxRetries: 2 });
  });

  it("continues on «followed» where the exit used to go", () => {
    const graph = { start: "a", nodes: [{ id: "a", type: "message", message: { text: "سلام" } }, { id: "b", type: "end" }], edges: [{ from: "a", to: "b", handle: "next" }] };
    const { graph: next, id } = addNode(graph, "follow_gate", { node: "a", handle: "next" });
    expect(next.edges).toContainEqual({ from: id, to: "b", handle: "true" });
  });
});

describe("Persian messages", () => {
  const t = createTranslator({ locale: "fa", messages });
  it("names every status, reason, exit and error", () => {
    for (const s of followUpStatuses) expect(t.has(`automations.followups.statuses.${s}` as never)).toBe(true);
    for (const r of followUpReasons) expect(t.has(`automations.followups.reasons.${r}` as never), r).toBe(true);
    for (const h of ["true", "false"]) expect(t.has(`flows.followHandles.${h}` as never)).toBe(true);
    for (const code of ["automation.followup_delay_invalid", "automation.one_followup", "flow.followup_invalid", "automation.followup_not_pending"]) expect(t.has(`errors.${code}` as never), code).toBe(true);
    expect(t("flows.typeHints.follow_gate" as never)).not.toBe("به‌زودی");
  });
});

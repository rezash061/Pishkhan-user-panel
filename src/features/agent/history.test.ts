import { describe, expect, it } from "vitest";
import type { SandboxResponse } from "@/lib/api/types";
import { toHistory, type Turn } from "./test-page";

const reply = (messages: string[]): SandboxResponse => ({ outcome: messages.length ? "sent" : "handed_off", messages, handoffReason: null, suggestedReply: null, unansweredQuestion: null, trace: {} as SandboxResponse["trace"] });

describe("sandbox history", () => {
  it("keeps what the customer wrote and what the agent actually sent", () => {
    const turns: Turn[] = [
      { id: 1, role: "customer", text: "سلام" },
      { id: 2, role: "agent", question: "سلام", response: reply(["سلام!", "چه کمکی از دستم برمی‌آید؟"]) },
      { id: 3, role: "customer", text: "تخفیف دارید؟" },
      { id: 4, role: "agent", question: "تخفیف دارید؟", response: reply([]) },
    ];
    expect(toHistory(turns)).toEqual([
      { role: "customer", text: "سلام" },
      { role: "agent", text: "سلام!\nچه کمکی از دستم برمی‌آید؟" },
      { role: "customer", text: "تخفیف دارید؟" },
    ]);
  });

  it("sends at most the last 20 turns", () => {
    const turns: Turn[] = Array.from({ length: 30 }, (_, i) => ({ id: i, role: "customer", text: String(i) }));
    const history = toHistory(turns);
    expect(history).toHaveLength(20);
    expect(history[0]!.text).toBe("10");
  });
});

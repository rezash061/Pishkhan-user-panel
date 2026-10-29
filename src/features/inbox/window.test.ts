import { describe, expect, it } from "vitest";
import { messagingWindow } from "./window";

const now = new Date("2026-10-29T10:00:00Z");

describe("messagingWindow", () => {
  it("is open within 24 hours of the customer's last message", () => {
    const w = messagingWindow({ lastInboundAt: "2026-10-29T08:00:00Z", windowExpiresAt: "2026-10-30T08:00:00Z", humanAgentUntil: "2026-11-05T08:00:00Z" }, now);
    expect(w).toEqual({ kind: "open", until: new Date("2026-10-30T08:00:00Z") });
  });

  it("allows only human-agent replies between 24 hours and 7 days", () => {
    const w = messagingWindow({ lastInboundAt: "2026-10-25T08:00:00Z", windowExpiresAt: "2026-10-26T08:00:00Z", humanAgentUntil: "2026-11-01T08:00:00Z" }, now);
    expect(w.kind).toBe("human");
  });

  it("is closed after 7 days", () => {
    const w = messagingWindow({ lastInboundAt: "2026-10-10T08:00:00Z", windowExpiresAt: "2026-10-11T08:00:00Z", humanAgentUntil: "2026-10-17T08:00:00Z" }, now);
    expect(w.kind).toBe("closed");
  });

  it("has no window when the customer never wrote", () => {
    expect(messagingWindow({ lastInboundAt: null, windowExpiresAt: null, humanAgentUntil: null }, now).kind).toBe("none");
  });
});

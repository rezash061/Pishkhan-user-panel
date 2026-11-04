import { useEffect, useState } from "react";

/**
 * Meta's messaging window for a conversation (plan 3.3 composer, glossary "24-hour window"):
 * - open: within 24 h of the customer's last message, any reply is allowed;
 * - human: 24 h to 7 days, only a human agent's reply (sent with the HUMAN_AGENT tag);
 * - closed: later than 7 days, nothing can be sent until the customer writes again;
 * - none: the customer never wrote (cannot happen for Instagram DMs, but the API allows it);
 * - always: Bale (BE-2.7 part 2) has no 24-hour rule; once the customer has written, replies are always allowed.
 */
export type WindowState = { kind: "open"; until: Date } | { kind: "human"; until: Date } | { kind: "closed" } | { kind: "none" } | { kind: "always" };

/** Channels without Meta's messaging window. */
export const windowlessChannels: ReadonlySet<string> = new Set(["bale"]);

export function messagingWindow(
  c: { windowExpiresAt: string | null; humanAgentUntil: string | null; lastInboundAt: string | null; channelKind?: string | null },
  now: Date = new Date(),
): WindowState {
  if (!c.lastInboundAt) return { kind: "none" };
  if (c.channelKind && windowlessChannels.has(c.channelKind)) return { kind: "always" };
  const open = c.windowExpiresAt ? new Date(c.windowExpiresAt) : null;
  if (open && open > now) return { kind: "open", until: open };
  const human = c.humanAgentUntil ? new Date(c.humanAgentUntil) : null;
  if (human && human > now) return { kind: "human", until: human };
  return { kind: "closed" };
}

/** The current time, refreshed every `intervalMs`, for countdowns and window checks during render. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** An Instagram conversation whose 24-hour window is still open, from its last inbound message alone. */
export function windowOpenSince(lastInboundAt: string | null, now: Date): boolean {
  return Boolean(lastInboundAt) && now.getTime() - new Date(lastInboundAt!).getTime() < 24 * 3_600_000;
}

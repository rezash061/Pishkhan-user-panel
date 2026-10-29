/**
 * Meta's messaging window for a conversation (plan 3.3 composer, glossary "24-hour window"):
 * - open: within 24 h of the customer's last message, any reply is allowed;
 * - human: 24 h to 7 days, only a human agent's reply (sent with the HUMAN_AGENT tag);
 * - closed: later than 7 days, nothing can be sent until the customer writes again;
 * - none: the customer never wrote (cannot happen for Instagram DMs, but the API allows it).
 */
export type WindowState = { kind: "open"; until: Date } | { kind: "human"; until: Date } | { kind: "closed" } | { kind: "none" };

export function messagingWindow(c: { windowExpiresAt: string | null; humanAgentUntil: string | null; lastInboundAt: string | null }, now: Date = new Date()): WindowState {
  if (!c.lastInboundAt) return { kind: "none" };
  const open = c.windowExpiresAt ? new Date(c.windowExpiresAt) : null;
  if (open && open > now) return { kind: "open", until: open };
  const human = c.humanAgentUntil ? new Date(c.humanAgentUntil) : null;
  if (human && human > now) return { kind: "human", until: human };
  return { kind: "closed" };
}

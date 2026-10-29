import type { Conversation } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";

/**
 * How a customer is shown: their Instagram name, else their @username, else «مشتری ۱a2b» from the end of the id
 * (a contact the channel has not told us anything about yet).
 */
export function contactName(c: Pick<Conversation, "contact" | "contactId">): { name: string | null; username: string | null; short: string } {
  const name = c.contact?.displayName?.trim() || null;
  const username = c.contact?.username?.trim() || null;
  return { name, username, short: toPersianDigits(c.contactId.replace(/-/g, "").slice(-4)) };
}

/** The customer's title for lists and headers, and their @username to show under it when the title is their name. */
export function contactTitle(c: Pick<Conversation, "contact" | "contactId">, customer: (short: string) => string): { title: string; handle: string | null } {
  const { name, username, short } = contactName(c);
  if (name) return { title: name, handle: username ? `@${username}` : null };
  if (username) return { title: `@${username}`, handle: null };
  return { title: customer(short), handle: null };
}

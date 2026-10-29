import { toPersianDigits } from "@/lib/i18n/digits";

/**
 * Short label for a contact. The conversations API returns only `contactId` until the CRM module exposes names and
 * usernames, so the panel shows «مشتری ۱a2b» from the end of the id.
 */
export function contactLabel(contactId: string): string {
  return toPersianDigits(contactId.replace(/-/g, "").slice(-4));
}

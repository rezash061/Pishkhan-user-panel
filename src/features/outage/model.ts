/** Campaign text limits (backend `OutageCampaign.MaxText`). */
export const CAMPAIGN_MIN = 5;
export const CAMPAIGN_MAX = 300;

export function campaignTextValid(text: string): boolean {
  const n = text.trim().length;
  return n >= CAMPAIGN_MIN && n <= CAMPAIGN_MAX;
}

/** What every recipient gets: the shop's name, a colon and a new line, then the text (backend `OutageCampaignEndpoints`). */
export function smsBody(shop: string, text: string): string {
  return `${shop}:\n${text.trim()}`;
}

// The GSM 7-bit default alphabet (and its extension table, which takes two septets).
const gsm = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const gsmExt = "^{}\\[~]|€";

/**
 * How many SMS parts a message takes. Persian text is sent as UCS-2: 70 characters in one part, 67 per part after
 * that. Latin-only text uses GSM: 160, then 153 per part.
 */
export function smsParts(body: string): { parts: number; unicode: boolean; length: number } {
  const chars = [...body];
  const unicode = chars.some((c) => !gsm.includes(c) && !gsmExt.includes(c));
  if (unicode) {
    const length = chars.reduce((n, c) => n + (c.codePointAt(0)! > 0xffff ? 2 : 1), 0);
    return { parts: length <= 70 ? 1 : Math.ceil(length / 67), unicode, length };
  }
  const length = chars.reduce((n, c) => n + (gsmExt.includes(c) ? 2 : 1), 0);
  return { parts: length <= 160 ? 1 : Math.ceil(length / 153), unicode, length };
}

/** Placeholder the backend replaces with each recipient's own Bale link (BE-2.7 part 2). */
export const BALE_LINK = "{link}";

/** Whether the text already points somewhere customers can still reach the shop (a link, the Bale placeholder, or Bale). */
export function hasLink(text: string): boolean {
  return text.includes(BALE_LINK) || /https?:\/\/|www\.|\b[\w-]+\.(ir|com|net|org|shop|store)\b|ble\.ir|بله/i.test(text);
}

/** Puts `{link}` at the cursor (or the end), with a space on each side where needed. Returns the text and the new cursor. */
export function insertLink(text: string, start = text.length, end = start): { text: string; cursor: number } {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^\s/.test(after) ? " " : "";
  const value = `${before}${lead}${BALE_LINK}${trail}${after}`;
  return { text: value, cursor: before.length + lead.length + BALE_LINK.length };
}

/** A sample of what `{link}` becomes, for the preview. */
export function sampleBaleLink(botUsername: string | null | undefined): string {
  return `https://ble.ir/${botUsername || "shop_bot"}?start=Xa7…`;
}

/** The SMS a recipient gets, with `{link}` shown as a sample link. */
export function previewBody(shop: string, text: string, botUsername?: string | null): string {
  return smsBody(shop, text.split(BALE_LINK).join(sampleBaleLink(botUsername)));
}

export const isDown = (status: string | undefined) => status === "down";

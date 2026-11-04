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

/** Whether the text already points somewhere customers can still reach the shop (a link, or Bale). */
export function hasLink(text: string): boolean {
  return /https?:\/\/|www\.|\b[\w-]+\.(ir|com|net|org|shop|store)\b|ble\.ir|بله/i.test(text);
}

export const isDown = (status: string | undefined) => status === "down";

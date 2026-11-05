import { digitsOnly, toLatinDigits } from "@/lib/i18n/digits";

/** A card number typed with spaces, dashes or Persian digits, as 16 Latin digits; null when it is not 16 digits. */
export function cleanCard(input: string): string | null {
  const d = digitsOnly(input);
  return d.length === 16 ? d : null;
}

/** Luhn checksum, as the backend's `BankCard.IsValid` checks Iranian (Shetab) cards. */
export function isValidCard(input: string): boolean {
  const d = cleanCard(input);
  if (!d) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let n = Number(d[15 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** A Sheba typed with or without «IR», spaces or Persian digits, as `IR` + 24 digits; null when it cannot be one. */
export function cleanSheba(input: string): string | null {
  const s = toLatinDigits(input).replace(/[\s-]/g, "").toUpperCase();
  const digits = s.startsWith("IR") ? s.slice(2) : s;
  return /^\d{24}$/.test(digits) ? `IR${digits}` : null;
}

/** ISO 13616 mod 97, as the backend's `Sheba.IsValid`: the first four characters move to the end, I=18 and R=27. */
export function isValidSheba(input: string): boolean {
  const iban = cleanSheba(input);
  if (!iban) return false;
  const rearranged = `${iban.slice(4)}1827${iban.slice(2, 4)}`;
  let remainder = 0;
  for (const c of rearranged) remainder = (remainder * 10 + Number(c)) % 97;
  return remainder === 1;
}

/** 6037-9912-3456-7893, left to right whatever the page direction. */
export function formatCard(card: string): string {
  return card.replace(/(\d{4})(?=\d)/g, "$1-");
}

/**
 * Finglish: Persian written in Latin letters («salam gheymatesh chande?»). The backend (BE-2.3 `Pishkhan.Persian.Finglish`)
 * also checks its word lists before it reads a message in Persian; the panel only needs the character test, to hint to an
 * agent that the AI read such a message in Persian.
 */

/** Share of Latin letters among all letters at which a text counts as Latin-script (the backend's threshold). */
export const FINGLISH_LATIN_SHARE = 0.7;

const latin = /[A-Za-z]/;
// Persian/Arabic letters (not digits or punctuation).
const persian = /[ء-يٮ-ۓۺ-ۼپچژکگی]/;

/** Letters counted as `[latin, persian]`; digits, emoji, spaces and punctuation are ignored. */
export function letterCounts(text: string): [number, number] {
  let l = 0;
  let p = 0;
  for (const ch of text) {
    if (latin.test(ch)) l++;
    else if (persian.test(ch)) p++;
  }
  return [l, p];
}

/**
 * Whether an inbound message looks like Finglish: at least three letters, and at least 70% of them Latin. English also
 * passes this test; the hint wording ("the AI read it in Persian when it was Finglish") covers both.
 */
export function looksFinglish(text: string | null | undefined): boolean {
  if (!text) return false;
  // Links and @handles are Latin by nature and say nothing about the language.
  const words = text.replace(/https?:\/\/\S+|www\.\S+|@\w+|\S+@\S+/g, " ");
  const [l, p] = letterCounts(words);
  const total = l + p;
  return total >= 3 && l / total >= FINGLISH_LATIN_SHARE;
}

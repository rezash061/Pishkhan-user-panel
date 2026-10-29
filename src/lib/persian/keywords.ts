/**
 * Client mirror of backend `PersianNormalizer.Normalize` and `KeywordMatcher` (Automation), so the rule editor can show
 * what a keyword will match before the rule is saved. The backend stays the judge; tests share its cases.
 */

const ZWNJ = "‌";

const charMap: Record<string, string> = {
  "ي": "ی", // Arabic yeh → Persian yeh
  "ى": "ی", // alef maksura
  "ك": "ک", // Arabic kaf → keheh
  "ة": "ه", // teh marbuta
  "ۀ": "ه", // heh with yeh above
  "أ": "ا",
  "إ": "ا",
  "ٱ": "ا",
  "ؤ": "و",
  "ئ": "ی",
  "ە": "ه",
  "،": ",",
  "؛": ";",
  "؟": "?",
  "٪": "%",
  "۔": ".",
  "«": '"',
  "»": '"',
  "“": '"',
  "”": '"',
  "„": '"',
  "‘": "'",
  "’": "'",
  "–": "-",
  "—": "-",
  "−": "-",
  "٫": ".",
  "٬": ",",
};

const dropped = new Set(["ـ", "‍", "​", "﻿", "­", "‎", "‏", "‪", "‫", "‬", "‭", "‮", "⁦", "⁧", "⁨", "⁩"]);
const spaces = /[\t\n\r   -   　]/;

function mapChar(c: string): string {
  if (c in charMap) return charMap[c]!;
  if (dropped.has(c)) return "";
  if (spaces.test(c)) return " ";
  const code = c.charCodeAt(0);
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  // Harakat, superscript alef, Quranic marks.
  if ((code >= 0x064b && code <= 0x065f) || code === 0x0670 || (code >= 0x06d6 && code <= 0x06ed)) return "";
  if (c >= "A" && c <= "Z") return c.toLowerCase();
  if (code < 0x20 || (code >= 0x7f && code < 0xa0)) return "";
  return c;
}

export function isPersianLetter(c: string): boolean {
  const code = c.charCodeAt(0);
  return (code >= 0x0621 && code <= 0x063a) || (code >= 0x0641 && code <= 0x064a) || "پچژکگیآ".includes(c);
}

function collapseRepeats(input: string, maxRepeat = 2): string {
  let out = "";
  let run = 0;
  let previous = "";
  for (const c of input) {
    run = c === previous ? run + 1 : 1;
    previous = c;
    // Digits are never collapsed: "1000" stays "1000".
    if (run > maxRepeat && /\p{L}/u.test(c)) continue;
    out += c;
  }
  return out;
}

/** `PersianNormalizer.Normalize` with default options: Persian letters, Latin digits, unified punctuation, no tatweel, ZWNJ only between letters. */
export function normalizePersian(input: string | null | undefined): string {
  if (!input) return "";
  const text = input.normalize("NFKC");
  let out = "";
  let pendingSpace = false;
  let pendingZwnj = false;
  for (let i = 0; i < text.length; i++) {
    const c = mapChar(text[i]!);
    if (c === "") continue;
    if (c === " ") {
      pendingSpace = out.length > 0;
      pendingZwnj = false;
      continue;
    }
    if (c === ZWNJ) {
      if (!pendingSpace && out.length > 0 && isPersianLetter(out[out.length - 1]!)) pendingZwnj = true;
      continue;
    }
    if (pendingSpace) {
      out += " ";
      pendingSpace = false;
    }
    if (pendingZwnj) {
      if (isPersianLetter(c)) out += ZWNJ;
      pendingZwnj = false;
    }
    out += c;
  }
  return collapseRepeats(out);
}

/** `KeywordMatcher.Key`: normalized, lower case, punctuation, symbols and half-spaces as single spaces. */
export function matchKey(text: string | null | undefined): string {
  const normalized = normalizePersian(text).toLowerCase();
  let out = "";
  for (const ch of normalized) {
    const separator = ch === ZWNJ || /[\p{White_Space}\p{P}\p{S}\p{Cn}\p{Cs}\p{Cf}]/u.test(ch);
    if (separator) {
      if (out.length > 0 && !out.endsWith(" ")) out += " ";
      continue;
    }
    out += ch;
  }
  return out.trimEnd();
}

export const compact = (key: string) => key.replaceAll(" ", "");

function containsPhrase(textKey: string, phraseKey: string): boolean {
  const phrase = compact(phraseKey);
  if (!phrase) return false;
  const words = textKey.split(" ").filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    let joined = "";
    for (let n = 0; n < 4 && i + n < words.length; n++) {
      joined += words[i + n];
      if (joined === phrase) return true;
      if (joined.length >= phrase.length) break;
    }
  }
  return false;
}

/** `KeywordMatcher.CompilePattern`: `*` is any text, `|` separates alternatives. Null when nothing is left to match. */
export function compilePattern(pattern: string): RegExp | null {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alternatives = pattern
    .split("|")
    .map((alt) =>
      alt
        .split("*")
        .map((part) => escape(compact(matchKey(part))))
        .join(".*"),
    )
    .filter((alt) => alt.replaceAll(".*", "").length > 0);
  return alternatives.length ? new RegExp(`^(?:${alternatives.join("|")})$`, "u") : null;
}

export interface KeywordTrigger {
  match?: string | null;
  keywords?: string[] | null;
  pattern?: string | null;
}

/** `KeywordMatcher.Matches`: does this message start the rule? */
export function keywordMatches(trigger: KeywordTrigger, text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const key = matchKey(text);
  const keywords = trigger.keywords ?? [];
  switch (trigger.match ?? "contains") {
    case "exact":
      return keywords.some((k) => {
        const kw = compact(matchKey(k));
        return kw.length > 0 && compact(key) === kw;
      });
    case "contains":
      return keywords.some((k) => {
        const kw = compact(matchKey(k));
        return kw.length > 0 && compact(key).includes(kw);
      });
    case "any_of":
      return keywords.some((k) => containsPhrase(key, matchKey(k)));
    case "pattern": {
      const regex = trigger.pattern ? compilePattern(trigger.pattern) : null;
      return regex ? regex.test(compact(key)) : false;
    }
    default:
      return false;
  }
}

/** A keyword is usable when something is left after normalization (the backend rejects «؟؟» or «😍» alone). */
export function isUsableKeyword(keyword: string): boolean {
  return compact(matchKey(keyword)).length > 0 && keyword.length <= 100;
}

/**
 * Spellings customers type that match the same keyword: Arabic ي/ك, half-space vs space vs joined, Persian vs Latin digits.
 * Shown under the keyword as «این‌ها هم پیدا می‌شوند: …» (plan 3.4).
 */
export function keywordVariants(keyword: string, limit = 4): string[] {
  const base = normalizePersian(keyword).trim();
  if (!base) return [];
  const out = new Set<string>();
  const add = (v: string) => {
    if (v && v !== keyword.trim()) out.add(v);
  };
  add(base.replaceAll("ی", "ي").replaceAll("ک", "ك"));
  if (base.includes(ZWNJ)) {
    add(base.replaceAll(ZWNJ, " "));
    add(base.replaceAll(ZWNJ, ""));
  } else if (base.includes(" ")) {
    add(base.replaceAll(" ", ZWNJ));
    add(base.replaceAll(" ", ""));
  }
  if (/[0-9]/.test(base)) add(base.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!));
  if (/[a-z]/.test(base)) add(base.toUpperCase());
  add(`${base}؟`);
  return [...out].slice(0, limit);
}

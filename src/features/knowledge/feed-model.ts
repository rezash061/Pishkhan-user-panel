import type { FeedItem, FeedItemUpdate } from "@/lib/api/types";
import { moneyFromToman, tomanOf } from "@/lib/money";

/** Backend limits for an import (BE-2.5): 1–200 posts, 50 by default. */
export const FEED_MIN_POSTS = 1;
export const FEED_MAX_POSTS = 200;
export const FEED_DEFAULT_POSTS = 50;
/** `POST /accept` takes at most 100 suggestions at a time. */
export const FEED_ACCEPT_BATCH = 100;

export function clampPosts(n: number): number {
  if (!Number.isFinite(n)) return FEED_DEFAULT_POSTS;
  return Math.max(FEED_MIN_POSTS, Math.min(FEED_MAX_POSTS, Math.round(n)));
}

export interface PostGroup {
  mediaId: string;
  permalink: string | null;
  imageUrl: string | null;
  items: FeedItem[];
}

/** Suggestions grouped by the post they came from, posts in the order their first suggestion appears (pending first). */
export function groupByPost(items: FeedItem[]): PostGroup[] {
  const groups = new Map<string, PostGroup>();
  for (const item of items) {
    const g = groups.get(item.mediaId) ?? { mediaId: item.mediaId, permalink: item.permalink, imageUrl: item.imageUrl, items: [] };
    g.permalink ??= item.permalink;
    g.imageUrl ??= item.imageUrl;
    g.items.push(item);
    groups.set(item.mediaId, g);
  }
  return [...groups.values()];
}

/** The editable fields of a suggestion; prices in whole Toman. */
export interface ItemDraft {
  title: string;
  description: string;
  price: number | null;
  tags: string[];
  question: string;
  answer: string;
}

export function draftOf(item: FeedItem): ItemDraft {
  return {
    title: item.title ?? "",
    description: item.description ?? "",
    price: tomanOf(item.price),
    tags: item.tags ?? [],
    question: item.question ?? "",
    answer: item.answer ?? "",
  };
}

export function sameDraft(a: ItemDraft, b: ItemDraft): boolean {
  return a.title === b.title && a.description === b.description && a.price === b.price && a.question === b.question && a.answer === b.answer && a.tags.join("\u0000") === b.tags.join("\u0000");
}

/** The PUT body for an edited suggestion: only the fields of its kind. */
export function updateOf(kind: string, d: ItemDraft): FeedItemUpdate {
  return kind === "faq"
    ? { title: null, description: null, price: null, tags: null, question: d.question.trim(), answer: d.answer.trim() }
    : { title: d.title.trim(), description: d.description.trim() || null, price: moneyFromToman(d.price), tags: d.tags, question: null, answer: null };
}

/**
 * What accepting a product does: on sale only when its price is confirmed (written in the caption, or set by the owner
 * here), otherwise a catalog draft. FAQs always become enabled knowledge.
 */
export function acceptOutcome(item: Pick<FeedItem, "kind" | "priceInCaption" | "price">): "faq" | "active" | "draft" {
  if (item.kind === "faq") return "faq";
  return item.priceInCaption && item.price ? "active" : "draft";
}

/** Persian-ready problem keys for a failed accept: the catalog's own error codes, under `errors.*`. */
export function failureCodes(failed: Record<string, string[]> | undefined, itemId: string): string[] {
  return failed?.[itemId] ?? [];
}

export const isPending = (item: Pick<FeedItem, "status">) => item.status === "pending";

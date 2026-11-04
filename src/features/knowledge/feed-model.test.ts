import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fa.json";
import type { FeedItem } from "@/lib/api/types";
import { acceptOutcome, clampPosts, draftOf, groupByPost, sameDraft, updateOf } from "./feed-model";

const item = (over: Partial<FeedItem>): FeedItem => ({
  id: "i", kind: "product", status: "pending", mediaId: "m1", permalink: "https://instagram.com/p/m1", imageUrl: "https://cdn.example/m1.jpg",
  title: "مانتو کتان", description: "تابستانه", price: { amount: 8_900_000, currency: "IRR" }, priceInCaption: true, tags: ["مانتو"], question: null, answer: null, createdId: null, ...over,
});

describe("feed import review", () => {
  it("keeps the post count between 1 and 200", () => {
    expect([0, 1, 50, 200, 500, Number.NaN].map(clampPosts)).toEqual([1, 1, 50, 200, 200, 50]);
  });

  it("groups suggestions by post, in order, with the post's image and link", () => {
    const groups = groupByPost([item({ id: "a", mediaId: "m1" }), item({ id: "b", mediaId: "m2", imageUrl: null }), item({ id: "c", mediaId: "m1", kind: "faq" })]);
    expect(groups.map((g) => [g.mediaId, g.items.map((i) => i.id)])).toEqual([["m1", ["a", "c"]], ["m2", ["b"]]]);
    expect(groups[0]!.imageUrl).toBe("https://cdn.example/m1.jpg");
  });

  it("edits in Toman and sends Rial, only the fields of the kind", () => {
    const d = draftOf(item({}));
    expect(d.price).toBe(890_000);
    expect(updateOf("product", { ...d, price: 950_000, title: " مانتو " })).toEqual({ title: "مانتو", description: "تابستانه", price: { amount: 9_500_000, currency: "IRR" }, tags: ["مانتو"], question: null, answer: null });
    expect(updateOf("faq", { ...d, question: " ارسال؟ ", answer: "۲ روز" })).toEqual({ title: null, description: null, price: null, tags: null, question: "ارسال؟", answer: "۲ روز" });
    expect(sameDraft(d, draftOf(item({})))).toBe(true);
    expect(sameDraft(d, { ...d, tags: ["کتان"] })).toBe(false);
  });

  it("puts a product on sale only with a confirmed price", () => {
    expect(acceptOutcome(item({}))).toBe("active");
    expect(acceptOutcome(item({ priceInCaption: false }))).toBe("draft");
    expect(acceptOutcome(item({ price: null }))).toBe("draft");
    expect(acceptOutcome(item({ kind: "faq" }))).toBe("faq");
  });

  it("has Persian messages for the BE-2.5 errors and the price warning", () => {
    const t = createTranslator({ locale: "fa", messages });
    for (const k of ["feed_import_running", "channel_not_found", "feed_item_invalid", "feed_item_not_pending"]) expect(t.has(`errors.knowledge.${k}` as never), k).toBe(true);
    expect(t("knowledge.feed.priceNotInCaption" as never)).toBe("این قیمت در متن پست نبود؛ بررسی کنید");
  });
});

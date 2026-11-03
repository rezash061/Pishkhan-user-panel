import { describe, expect, it } from "vitest";
import type { OptimisticMessage } from "./data";
import { mergeMessage } from "./data";

const at = (min: number) => new Date(Date.UTC(2026, 10, 3, 10, min)).toISOString();
const msg = (id: string, min: number, over: Partial<OptimisticMessage> = {}): OptimisticMessage => ({
  id, createdAt: at(min), direction: "inbound", kind: "text", text: id, status: "received", errorCode: null, handledBy: null, sentBy: null, tag: null, sentAt: null, readAt: null, attachments: [], ...over,
});
const voice = (over: Partial<OptimisticMessage> = {}) =>
  msg("v", 5, { kind: "audio", text: null, attachments: [{ type: "audio", url: "https://cdn.example/voice.mp4" }], transcript: null, transcriptStatus: "pending", ...over });
const ids = (pages: { items: OptimisticMessage[] }[]) => pages.map((p) => p.items.map((m) => m.id));

describe("mergeMessage", () => {
  it("replaces a pushed voice note by id instead of adding it twice", () => {
    const pages = [{ items: [msg("c", 9), voice(), msg("a", 1)], nextCursor: null }];
    const next = mergeMessage(pages, voice({ transcript: "سلام، سایز M دارید؟", transcriptStatus: "done" }));
    expect(ids(next)).toEqual([["c", "v", "a"]]);
    expect(next[0]!.items[1]).toMatchObject({ transcript: "سلام، سایز M دارید؟", transcriptStatus: "done", kind: "audio" });
    expect(next[0]!.items[1]!.attachments).toHaveLength(1);
  });

  it("finds the message on an older page too", () => {
    const pages = [{ items: [msg("d", 20)], nextCursor: "x" }, { items: [voice(), msg("a", 1)], nextCursor: null }];
    const next = mergeMessage(pages, voice({ transcriptStatus: "failed" }));
    expect(ids(next)).toEqual([["d"], ["v", "a"]]);
    expect(next[1]!.items[0]!.transcriptStatus).toBe("failed");
  });

  it("keeps fields a push leaves out", () => {
    const pages = [{ items: [voice({ transcript: "قبلی" })], nextCursor: null }];
    const { transcript: _omit, ...partial } = voice({ transcriptStatus: "done" });
    void _omit;
    expect(mergeMessage(pages, partial as OptimisticMessage)[0]!.items[0]!.transcript).toBe("قبلی");
  });

  it("adds a new message at the top, or where its time belongs", () => {
    const pages = [{ items: [msg("c", 9), msg("a", 1)], nextCursor: null }];
    expect(ids(mergeMessage(pages, msg("n", 12)))).toEqual([["n", "c", "a"]]);
    expect(ids(mergeMessage(pages, msg("b", 4)))).toEqual([["c", "b", "a"]]);
  });

  it("leaves a message older than everything loaded for its own page", () => {
    const pages = [{ items: [msg("c", 9)], nextCursor: "older" }];
    expect(ids(mergeMessage(pages, msg("z", 0)))).toEqual([["c"]]);
    // With nothing older to fetch it belongs at the end.
    expect(ids(mergeMessage([{ items: [msg("c", 9)], nextCursor: null }], msg("z", 0)))).toEqual([["c", "z"]]);
  });

  it("swaps an optimistic send for the server's copy", () => {
    const pages = [{ items: [msg("local-1", 9, { local: "sending", direction: "outbound" }), msg("a", 1)], nextCursor: null }];
    const next = mergeMessage(pages, msg("server-1", 9, { direction: "outbound" }), "local-1");
    expect(ids(next)).toEqual([["server-1", "a"]]);
    expect(next[0]!.items[0]!.local).toBeUndefined();
  });
});

describe("voice note messages", () => {
  it("has Persian text for every transcript state and the voice handoff", async () => {
    const { createTranslator } = await import("next-intl");
    const messages = (await import("../../../messages/fa.json")).default;
    const t = createTranslator({ locale: "fa", messages });
    expect(t("inbox.voice.pending" as never)).toBe("در حال تبدیل صدا به متن…");
    expect(t("inbox.voice.label" as never)).toBe("متن پیام صوتی");
    expect(t("inbox.voice.failed" as never)).toBe("تبدیل انجام نشد — گفتگو به همکار شما سپرده شد");
    expect(t("inbox.handoff.reasons.voice_unavailable" as never)).toBe("پیام صوتی قابل تبدیل نبود");
  });
});

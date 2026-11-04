import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fa.json";
import { BALE_LINK, hasLink, insertLink, previewBody, sampleBaleLink } from "@/features/outage/model";
import { messagingWindow, windowOpenSince } from "@/features/inbox/window";
import { baleTokenPattern } from "./bale";

describe("Bale", () => {
  it("accepts tokens shaped like BotFather's", () => {
    expect(baleTokenPattern.test("1234567890:AbCdEfGhIjKlMnOpQrStUvWxYz_-12")).toBe(true);
    expect(baleTokenPattern.test("1234567890")).toBe(false);
    expect(baleTokenPattern.test("abc:defghijklmnopqrstuvwxyz")).toBe(false);
  });

  it("has no 24-hour window", () => {
    const old = { lastInboundAt: "2026-10-01T08:00:00Z", windowExpiresAt: "2026-10-02T08:00:00Z", humanAgentUntil: "2026-10-08T08:00:00Z" };
    const now = new Date("2026-11-04T10:00:00Z");
    expect(messagingWindow({ ...old, channelKind: "bale" }, now)).toEqual({ kind: "always" });
    expect(messagingWindow({ ...old, channelKind: "instagram" }, now).kind).toBe("closed");
    expect(messagingWindow({ lastInboundAt: null, windowExpiresAt: null, humanAgentUntil: null, channelKind: "bale" }, now).kind).toBe("none");
  });

  it("tells an open Instagram window from the last inbound message", () => {
    const now = new Date("2026-11-04T10:00:00Z");
    expect(windowOpenSince("2026-11-04T08:00:00Z", now)).toBe(true);
    expect(windowOpenSince("2026-11-03T09:00:00Z", now)).toBe(false);
    expect(windowOpenSince(null, now)).toBe(false);
  });

  it("inserts {link} at the cursor with spaces around it", () => {
    expect(insertLink("در بله پیام بدهید:")).toEqual({ text: `در بله پیام بدهید: ${BALE_LINK}`, cursor: 25 });
    expect(insertLink("سلام دنیا", 4, 4).text).toBe(`سلام ${BALE_LINK} دنیا`);
    expect(insertLink("", 0).text).toBe(BALE_LINK);
    expect(hasLink(`ما را در ${BALE_LINK} پیدا کنید`)).toBe(true);
  });

  it("previews {link} as a sample link after the shop's name", () => {
    expect(previewBody("گالری نیلوفر", `پیام بدهید: ${BALE_LINK}`, "niloofar_bot")).toBe(`گالری نیلوفر:\nپیام بدهید: ${sampleBaleLink("niloofar_bot")}`);
    expect(sampleBaleLink(null)).toContain("https://ble.ir/");
  });

  it("has Persian messages for every Bale error", () => {
    const t = createTranslator({ locale: "fa", messages });
    for (const k of ["channels.bale_token_invalid", "channels.bale_bot_taken", "channels.bale_unavailable", "channels.bale_not_connected", "billing.plan_limit", "outage.link_needs_bale"]) expect(t.has(`errors.${k}` as never), k).toBe(true);
  });
});

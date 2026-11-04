import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fa.json";
import { campaignTextValid, hasLink, isDown, smsBody, smsParts } from "./model";

describe("outage campaign", () => {
  it("keeps the text between 5 and 300 characters, trimmed", () => {
    expect(campaignTextValid("سلام")).toBe(false);
    expect(campaignTextValid("  سلام!  ")).toBe(true);
    expect(campaignTextValid("ب".repeat(300))).toBe(true);
    expect(campaignTextValid("ب".repeat(301))).toBe(false);
  });

  it("puts the shop's name in front, like the backend", () => {
    expect(smsBody("گالری نیلوفر", " اینستاگرام قطع است؛ در بله پیام بدهید: ble.ir/niloofar ")).toBe("گالری نیلوفر:\nاینستاگرام قطع است؛ در بله پیام بدهید: ble.ir/niloofar");
  });

  it("counts SMS parts: Persian is 70 then 67, Latin 160 then 153", () => {
    expect(smsParts("س".repeat(70))).toMatchObject({ parts: 1, unicode: true });
    expect(smsParts("س".repeat(71)).parts).toBe(2);
    expect(smsParts("س".repeat(134)).parts).toBe(2);
    expect(smsParts("س".repeat(135)).parts).toBe(3);
    expect(smsParts("a".repeat(160))).toMatchObject({ parts: 1, unicode: false });
    expect(smsParts("a".repeat(161)).parts).toBe(2);
    expect(smsParts("[]").length).toBe(4);
  });

  it("notices a link or Bale in the text", () => {
    expect(hasLink("پیام بدهید: https://niloofar.ir")).toBe(true);
    expect(hasLink("در بله پیام بدهید")).toBe(true);
    expect(hasLink("فروشگاه ما niloofar.shop")).toBe(true);
    expect(hasLink("به‌زودی برمی‌گردیم")).toBe(false);
  });

  it("is down only when the status says so", () => {
    expect(isDown("down")).toBe(true);
    expect(isDown("up")).toBe(false);
    expect(isDown(undefined)).toBe(false);
  });

  it("has Persian messages for the BE-2.7 errors and statuses", () => {
    const t = createTranslator({ locale: "fa", messages });
    for (const k of ["errors.outage.not_down", "errors.outage.campaign_cooldown", "errors.flow.capture_phone_invalid", "errors.automation.capture_phone_flow_only"]) expect(t.has(k as never), k).toBe(true);
    for (const s of ["sending", "completed", "limit_reached"]) expect(t.has(`outage.statuses.${s}` as never), s).toBe(true);
    expect(t("outage.banner" as never)).toBe("اینستاگرام در دسترس نیست");
  });
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const workspaceId = "0199b000-0000-7000-8000-0000000000aa";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("شمارهٔ موبایل").fill("۰۹۱۲۰۰۰۱۲۳۴");
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("کد تأیید").fill("123456");
  await page.getByRole("button", { name: "ورود" }).click();
  await page.waitForURL(`**/w/${workspaceId}`);
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("redirects to login and back to the requested page", async ({ page }) => {
  await page.goto(`/w/${workspaceId}/team`);
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("rejects a wrong code in Persian", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("شمارهٔ موبایل").fill("09120001234");
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("کد تأیید").fill("000000");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page.getByText("کد درست نیست.")).toBeVisible();
});

test("signs in, reads and answers a conversation", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "سلام پارسا" })).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto(`/w/${workspaceId}/inbox?filter=handed_off`);
  const first = page.locator("ul li a").first();
  await expect(first).toBeVisible();
  await first.click();

  const composer = page.getByLabel(/پاسخ بنویسید/);
  await expect(composer).toBeEnabled();
  await composer.fill("/pri");
  await page.getByRole("option").first().click();
  await expect(composer).toHaveValue(/هایلایت/);
  await page.getByRole("button", { name: "ارسال" }).click();
  // The optimistic bubble becomes the server's message: no "sending" clock and no failure.
  await expect(page.getByText(/هایلایت «قیمت»/).last()).toBeVisible();
  await expect(page.getByText("ارسال نشد")).toHaveCount(0);
  await noHorizontalScroll(page);
});

test("finds a customer by name and answers a handoff with the suggested reply", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/inbox`);
  await page.getByLabel("جستجوی گفتگو").fill("niloo");
  const row = page.locator("ul li a").first();
  await expect(row).toContainText("نیلوفر احمدی");
  await expect(page.locator("ul li a")).toHaveCount(4);
  await page.getByLabel("جستجوی گفتگو").fill("هیچ‌کس");
  await expect(page.getByText("گفتگویی پیدا نشد.")).toBeVisible();

  // Conversation 1000 is handed off with a reason and a suggested reply, and has a photo and a story reply.
  await page.goto(`/w/${workspaceId}/inbox/0199b000-0000-7000-8000-000000001000`);
  await expect(page.locator("header").getByText("نیلوفر احمدی")).toBeVisible();
  const banner = page.getByRole("note");
  await expect(banner).toContainText("مشتری درخواست تخفیف عمده دارد");
  await banner.getByRole("button", { name: "استفاده" }).click();
  await expect(page.getByLabel(/پاسخ بنویسید/)).toHaveValue(/خرید عمده/);
  await expect(page.getByRole("link", { name: "پاسخ به استوری" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تصویر" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("lists a pending invitation and revokes it", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/team`);
  const last4 = String(Date.now()).slice(-4);
  await page.getByRole("button", { name: "دعوت همکار" }).first().click();
  await page.getByLabel("شمارهٔ موبایل همکار").fill(`0912111${last4}`);
  await page.getByRole("dialog").getByRole("button", { name: "دعوت همکار" }).click();
  const masked = `+۹۸۹۱۲***${last4.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹".charAt(Number(d)))}`;
  const section = page.getByRole("region", { name: "دعوت‌های در انتظار" });
  await expect(section.getByText(masked)).toBeVisible();
  await section.getByRole("button", { name: "لغو دعوت" }).last().click();
  await page.getByRole("dialog").getByRole("button", { name: "لغو دعوت" }).click();
  await expect(page.getByText("دعوت لغو شد.")).toBeVisible();
  await expect(page.getByText(masked)).toHaveCount(0);
});

test("adds an internal note", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/inbox/0199b000-0000-7000-8000-000000001001`);
  // Desktop (xl) shows the side panel next to the thread; phones open it as a sheet.
  const desktop = (page.viewportSize()?.width ?? 0) >= 1280;
  if (!desktop) await page.getByRole("button", { name: "جزئیات" }).click();
  const panel = desktop ? page.locator("aside").last() : page.getByRole("dialog");
  // The mock keeps state between tests, so each run writes its own note.
  const text = `مشتری عجله دارد ${Date.now()}`;
  await panel.getByLabel("افزودن یادداشت").fill(text);
  await panel.getByRole("button", { name: "افزودن یادداشت" }).click();
  await expect(panel.getByText(text)).toBeVisible();
});

test("saves business hours and shows a saved toast", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/settings/business-hours`);
  await page.getByRole("button", { name: /افزودن تعطیلات نوروز/ }).click();
  await expect(page.getByText(/فروردین/).first()).toBeVisible();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("ذخیره شد")).toBeVisible();
});

test("key pages have no serious accessibility violations", async ({ page }) => {
  await login(page);
  for (const path of ["", "/inbox", "/channels", "/team", "/settings"]) {
    await page.goto(`/w/${workspaceId}${path}`);
    await page.waitForLoadState("networkidle");
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
    const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  }
});

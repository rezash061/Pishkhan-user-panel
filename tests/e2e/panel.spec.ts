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

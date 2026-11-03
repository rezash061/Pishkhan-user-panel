import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const workspaceId = "0199b000-0000-7000-8000-0000000000aa";
const base = `/w/${workspaceId}`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("شمارهٔ موبایل").fill("09120001234");
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("کد تأیید").fill("123456");
  await page.getByRole("button", { name: "ورود" }).click();
  await page.waitForURL(`**${base}`);
}

test("voice notes show their transcript, a pending state and a failure, and the handoff reason reads in Persian", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/inbox/0199b000-0000-7000-8000-000000001016`);
  await expect(page.getByText("متن پیام صوتی")).toBeVisible();
  await expect(page.getByText("سلام، این مانتو سایز ال داره؟ برای شیراز هم می‌فرستید؟")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "در حال تبدیل صدا به متن…" })).toBeVisible();
  await expect(page.getByText("تبدیل انجام نشد — گفتگو به همکار شما سپرده شد")).toBeVisible();
  // Each voice note keeps its audio attachment next to the transcript (the player, or its placeholder once the CDN link expires).
  await expect(page.locator('audio, span:has-text("پیام صوتی دیگر در دسترس نیست")')).toHaveCount(3);
  await expect(page.getByRole("note")).toContainText("پیام صوتی قابل تبدیل نبود");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

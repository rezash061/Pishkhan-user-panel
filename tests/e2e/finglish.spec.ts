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

test("Finglish: a hint on Latin-letter customer messages, the trace language, and the rule editor help", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/inbox/0199b000-0000-7000-8000-000000001001`);
  const finglish = page.getByText("rang kerem ham darid?");
  await expect(finglish).toBeVisible();
  // Only the Latin-letter message carries the hint.
  await expect(page.getByText(/^فینگلیش:/)).toHaveCount(1);

  await page.goto(`${base}/agent/log`);
  await page.getByRole("link", { name: /salam gheymatesh chande\?/ }).click();
  await expect(page.getByRole("definition").filter({ hasText: /^فینگلیش/ })).toContainText("دستیار آن را به خط فارسی خواند");

  await page.goto(`${base}/automations/rules/new?trigger=dm_keyword`);
  await expect(page.getByText("کلمه‌های فارسی با فینگلیش هم پیدا می‌شوند؛ مثلاً «gheymat» با «قیمت» جور است.")).toBeVisible();
});

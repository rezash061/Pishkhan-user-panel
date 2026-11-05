import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const workspaceId = "0199b000-0000-7000-8000-0000000000aa";
const base = `/w/${workspaceId}`;
const mock = "http://localhost:5080";
const run = Date.now().toString(36).slice(-4);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("شمارهٔ موبایل").fill("09120001234");
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("کد تأیید").fill("123456");
  await page.getByRole("button", { name: "ورود" }).click();
  await page.waitForURL(`**${base}`);
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${mock}/__mock/followups/reset`);
});

test("a flow with a follow gate: two labelled exits, help text, and validation", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations/flows`);
  await page.getByRole("button", { name: "سناریوی تازه" }).click();
  await page.waitForURL(/\/automations\/flows\/[0-9a-f-]{36}$/);
  await page.getByLabel("نام سناریو").fill(`کد تخفیف ${run}`);

  await page.getByLabel("start: بعد").selectOption("__new");
  const palette = page.getByRole("button", { name: /^شرط فالو/ });
  await expect(palette).not.toContainText("به‌زودی");
  await palette.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/دنبال کردم ✅/).first()).toBeVisible();
  await expect(dialog.getByText(/مشتری از مسیر «دنبال‌کرده» رد می‌شود/)).toBeVisible();
  await expect(dialog.getByLabel("دفعات بررسی دوباره")).toHaveValue("2");
  await page.getByRole("button", { name: "تمام", exact: true }).click();

  // The gate's two exits carry their own names.
  await expect(page.getByLabel("follow_gate_1: دنبال‌کرده")).toBeVisible();
  await expect(page.getByLabel("follow_gate_1: دنبال نکرده")).toBeVisible();
  await page.getByRole("button", { name: "انتشار" }).click();
  await expect(page.getByText("متن پیام را بنویسید.").first()).toBeVisible();

  await page.getByRole("button", { name: "ویرایش follow_gate_1" }).click();
  await page.locator("#node-follow_gate_1-gate").fill("برای دریافت کد تخفیف اول صفحه را دنبال کنید 🌸");
  await page.getByLabel("پیام وقتی هنوز دنبال نکرده").fill("هنوز دنبال نکردی؛ بعد از دنبال کردن دکمه را بزن.");
  await page.getByRole("button", { name: "تمام", exact: true }).click();
  await page.getByRole("button", { name: "انتشار" }).click();
  await expect(page.getByText("منتشرشده (نسخهٔ ۱)")).toBeVisible();
  await noHorizontalScroll(page);
});

test("a DM rule schedules a follow-up; one per rule and the delay stays inside the window", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations/rules/new?trigger=dm_keyword`);
  await page.getByLabel("نام قانون").fill(`پیگیری ${run}`);
  const keywords = page.getByLabel("کلمه‌ها");
  await keywords.fill("قیمت");
  await keywords.press("Enter");
  await page.getByRole("button", { name: "افزودن کار" }).click();
  await page.getByRole("button", { name: /^پیگیری/ }).click();
  await expect(page.getByText(/۲۴ ساعت بعد از آخرین پیام مشتری/)).toBeVisible();
  await expect(page.getByRole("switch", { name: "اگر مشتری پیام داد، فرستاده نشود" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("switch", { name: "اگر مشتری خرید کرد، فرستاده نشود" })).toHaveAttribute("aria-checked", "true");
  // One click turns a toggle off (a label around the switch used to toggle it twice).
  await page.getByRole("switch", { name: "اگر مشتری خرید کرد، فرستاده نشود" }).click();
  await expect(page.getByRole("switch", { name: "اگر مشتری خرید کرد، فرستاده نشود" })).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#action-0-delay")).toHaveValue("1");
  await page.locator("#action-0-delay").fill("30");
  // 30 hours is clamped to the 23-hour maximum.
  await expect(page.locator("#action-0-delay")).toHaveValue("23");
  await page.getByLabel("واحد").selectOption("minutes");
  await page.locator("#action-0-delay").fill("90");
  await page.locator("#action-0-message").fill("هنوز به این مدل فکر می‌کنی؟");
  // A second follow-up cannot be added.
  await page.getByRole("button", { name: "افزودن کار" }).click();
  await expect(page.getByRole("button", { name: /^پیگیری/ })).toHaveCount(0);
  await page.getByRole("button", { name: "انصراف" }).click();
  await page.getByRole("button", { name: "ساختن قانون" }).click();
  await page.waitForURL(/\/automations\/rules\/[0-9a-f-]{36}$/);
  await expect(page.locator("#action-0-delay")).toHaveValue("90");
});

test("follow-ups page: filter by status, translated reasons, cancel a pending one", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations`);
  await page.getByRole("link", { name: "پیگیری‌ها" }).click();
  await expect(page.getByRole("radio", { name: "در انتظار" })).toHaveAttribute("aria-checked", "true");
  const rows = page.getByRole("main").getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("هنوز به مانتو کتان فکر می‌کنی؟");
  await expect(rows.first()).toContainText(/زمان ارسال: .*۱۴۰۵/);
  await expect(rows.first().getByRole("link", { name: "گفتگو" })).toHaveAttribute("href", new RegExp(`${base}/inbox/`));
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await noHorizontalScroll(page);

  await rows.first().getByRole("button", { name: "لغو پیگیری" }).click();
  await page.getByRole("dialog", { name: "این پیگیری لغو شود؟" }).getByRole("button", { name: "لغو پیگیری" }).click();
  await expect(page.getByText("پیگیری لغو شد.")).toBeVisible();
  await expect(rows).toHaveCount(1);

  await page.getByRole("radio", { name: "لغوشده" }).click();
  await expect(page).toHaveURL(/status=cancelled/);
  await expect(page.getByText("دلیل: به دست تیم لغو شد")).toBeVisible();
  await expect(page.getByText("دلیل: مشتری پیام داد")).toBeVisible();
  await expect(page.getByText("دلیل: مشتری خرید کرد")).toBeVisible();
  await page.getByRole("radio", { name: "فرستاده‌نشده" }).click();
  await expect(page.getByText("دلیل: پنجرهٔ ۲۴ ساعتهٔ اینستاگرام بسته شده بود")).toBeVisible();
});

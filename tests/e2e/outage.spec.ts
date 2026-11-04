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

test.afterEach(async ({ request }) => {
  await request.post(`${mock}/__mock/outage?status=up&reset=1`);
});

test("outage: the banner leads to the campaign page; one SMS campaign, confirmed, with progress and the 24-hour cooldown", async ({ page, request }) => {
  await request.post(`${mock}/__mock/outage?status=up&reset=1`);
  await login(page);
  await expect(page.getByText("اینستاگرام در دسترس نیست")).toHaveCount(0);
  await page.goto(`${base}/settings/outage`);
  await expect(page.getByText("این پیامک فقط وقتی اینستاگرام (یا حساب اینستاگرام شما) قطع است فرستاده می‌شود.")).toBeVisible();

  await request.post(`${mock}/__mock/outage?status=down`);
  await page.goto(base);
  const banner = page.getByRole("alert").filter({ hasText: "اینستاگرام در دسترس نیست" });
  await expect(banner).toBeVisible();
  await banner.getByRole("link", { name: "پیامک به مشتری‌ها" }).click();
  await expect(page).toHaveURL(`${base}/settings/outage`);
  await expect(page.getByText("اینستاگرام قطع است", { exact: true })).toBeVisible();
  await expect(page.getByText("موافقت با پیامک")).toBeVisible();

  const text = page.getByLabel("متن پیامک");
  await text.fill("سلام");
  await expect(page.getByText("متن باید ۵ تا ۳۰۰ نویسه باشد.")).toBeVisible();
  await expect(page.getByRole("button", { name: "فرستادن پیامک" })).toBeDisabled();
  await text.fill("اینستاگرام قطع است؛ سفارش‌ها را تلفنی می‌گیریم.");
  await expect(page.getByText(/یک راه دیگر برای تماس بگذارید/)).toBeVisible();
  await text.fill("اینستاگرام قطع است؛ در بله پیام بدهید: ble.ir/niloofar");
  await expect(page.getByText(/یک راه دیگر برای تماس بگذارید/)).toHaveCount(0);
  // The preview puts the shop's name in front.
  await expect(page.getByLabel("پیش‌نمایش پیامک")).toHaveText("گالری نیلوفر:\nاینستاگرام قطع است؛ در بله پیام بدهید: ble.ir/niloofar");
  await expect(page.getByText(/^\S+ پیامک \(\S+ نویسه\)$/)).toBeVisible();
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  await page.getByRole("button", { name: "فرستادن پیامک" }).click();
  const dialog = page.getByRole("dialog", { name: "پیامک برای ۷ نفر فرستاده شود؟" });
  await dialog.getByRole("button", { name: "فرستادن به ۷ نفر" }).click();
  await expect(page.getByText("فرستادن پیامک‌ها شروع شد.")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: "ble.ir/niloofar" });
  await expect(row).toContainText("در حال فرستادن");
  await expect(row).toContainText("فرستاده شد", { timeout: 15_000 });
  await expect(row).toContainText("۶ فرستاده، ۱ ناموفق، از ۷");
  // Once per 24 hours: the next time is shown in Jalali and sending is off.
  await expect(page.getByRole("status").filter({ hasText: /پیامک بعدی از .*۱۴۰۵/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "فرستادن پیامک" })).toBeDisabled();
});

test("flows can save a phone with consent; rules cannot", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations/flows`);
  await page.getByRole("button", { name: "سناریوی تازه" }).click();
  await page.waitForURL(/\/automations\/flows\/[0-9a-f-]{36}$/);
  await page.getByLabel("نام سناریو").fill(`شماره ${run}`);
  await page.getByLabel("start: بعد").selectOption("__new");
  await page.getByRole("button", { name: /^کار برچسب/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "حذف این کار" }).click();
  await dialog.getByRole("button", { name: "افزودن کار" }).click();
  await dialog.getByRole("button", { name: /^ذخیره شماره با رضایت/ }).click();
  await expect(dialog.getByText(/رضایت او برای پیامک، همراه با همین سؤال/)).toBeVisible();
  await expect(dialog.getByLabel("شماره")).toHaveValue("{{flow.phone}}");
  await page.getByRole("button", { name: "تمام", exact: true }).click();
  await page.getByRole("button", { name: "انتشار" }).click();
  await expect(page.getByText(/«ذخیره شماره با رضایت» کامل نیست/).first()).toBeVisible();
  await page.getByRole("button", { name: "ویرایش action_1" }).click();
  await page.getByLabel("سؤالی که مشتری با آن موافقت کرد").fill("اگر اینستاگرام قطع شد، با پیامک خبرتان کنیم؟");
  await page.getByRole("button", { name: "تمام", exact: true }).click();
  await page.getByRole("button", { name: "انتشار" }).click();
  await expect(page.getByText("منتشرشده (نسخهٔ ۱)")).toBeVisible();

  // Rules do not offer it.
  await page.goto(`${base}/automations/rules/new?trigger=dm_keyword`);
  await page.getByRole("button", { name: "افزودن کار" }).click();
  await expect(page.getByRole("button", { name: /^ذخیره شماره با رضایت/ })).toHaveCount(0);
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const workspaceId = "0199b000-0000-7000-8000-0000000000aa";
const base = `/w/${workspaceId}`;
const mock = "http://localhost:5080";

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

const card = (page: Page, value: string) => page.getByRole("listitem").filter({ has: page.locator(`input[value="${value}"]`) });

test.beforeEach(async ({ request }) => {
  await request.post(`${mock}/__mock/feed/reset`);
});

test("feed import: start, progress, review with an unconfirmed price, accept selected with a failure, reject", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/knowledge`);
  await page.getByRole("link", { name: "ورود از پست‌ها" }).click();
  await expect(page.getByText(/تا خودتان هر پیشنهاد را نپذیرید/)).toBeVisible();
  // The earlier import is listed with what is still waiting.
  await expect(page.getByRole("link", { name: /۱ منتظر بررسی/ })).toBeVisible();

  await page.getByLabel("تعداد پست‌ها").fill("500");
  await page.getByLabel("تعداد پست‌ها").blur();
  await expect(page.getByLabel("تعداد پست‌ها")).toHaveValue("200");
  await page.getByLabel("تعداد پست‌ها").fill("30");
  await page.getByRole("button", { name: "شروع خواندن پست‌ها" }).click();
  await page.waitForURL(/\/knowledge\/import\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("status").filter({ hasText: "خواندن پست‌ها تمام شد" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("پیشنهاد پیدا شد")).toBeVisible();

  // Grouped by post, with a link to it.
  await expect(page.getByRole("link", { name: "دیدن پست در اینستاگرام" })).toHaveCount(3);
  await expect(page.getByText("۶ پیشنهاد منتظر بررسی")).toBeVisible();

  // The price that was not in the caption is flagged; editing it makes it the owner's, so the product goes on sale.
  const shomiz = card(page, "شومیز حریر گل‌دار");
  await expect(shomiz.getByRole("note")).toContainText("این قیمت در متن پست نبود؛ بررسی کنید");
  await expect(shomiz).toContainText("با پذیرفتن، محصول پیش‌نویس ساخته می‌شود.");
  await shomiz.getByLabel("قیمت (تومان)").fill("۶۸۰۰۰۰");
  await expect(shomiz).toContainText("با پذیرفتن، محصول فعال ساخته می‌شود.");
  await shomiz.getByRole("button", { name: "ذخیره و پذیرفتن" }).click();
  const accepted = page.getByRole("listitem").filter({ hasText: "شومیز حریر گل‌دار" }).filter({ hasText: "پذیرفته شد" });
  await expect(accepted).toBeVisible();
  await expect(accepted.getByRole("link", { name: "دیدن محصول" })).toBeVisible();
  await expect(accepted).toContainText("۶۸۰٬۰۰۰ تومان");
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  // A FAQ can be edited inline before accepting.
  const faq = card(page, "امکان تعویض دارید؟");
  await faq.getByLabel("جواب").fill("بله، تا ۷ روز بعد از تحویل، اگر برچسب جدا نشده باشد.");
  await faq.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
  await expect(page.getByText("تغییرات ذخیره شد.")).toBeVisible();

  // Reject one, then accept all the rest; the product without a name fails and says why.
  await card(page, "شال نخی").getByRole("button", { name: "رد کردن" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "شال نخی" }).filter({ hasText: "رد شد" })).toBeVisible();
  await page.getByRole("button", { name: "انتخاب همه" }).click();
  await page.getByRole("button", { name: /^پذیرفتن همه انتخاب‌شده‌ها/ }).click();
  await expect(page.getByText("۳ پیشنهاد پذیرفته شد.")).toBeVisible();
  const nameless = page.getByRole("listitem").filter({ has: page.locator('textarea:text("کیف دوشی چرم مصنوعی")') });
  await expect(nameless.getByRole("alert")).toContainText("این بخش را پر کنید.");
  await expect(page.getByText("۱ پیشنهاد منتظر بررسی")).toBeVisible();

  // The FAQs are in the knowledge base, the products in the catalog.
  await page.goto(`${base}/knowledge`);
  await expect(page.getByText("به شهرستان هم ارسال دارید؟").first()).toBeVisible();
  await page.goto(`${base}/catalog`);
  // (The mock keeps its catalog between the phone and desktop runs.)
  await expect(page.getByRole("link", { name: /شومیز حریر گل‌دار/ }).first()).toContainText("۶۸۰٬۰۰۰ تومان");
});

test("feed import: a second import while one runs is refused in Persian", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/knowledge/import`);
  await page.getByRole("button", { name: "شروع خواندن پست‌ها" }).click();
  await page.waitForURL(/\/knowledge\/import\/[0-9a-f-]{36}$/);
  await page.goto(`${base}/knowledge/import`);
  await page.getByRole("button", { name: "شروع خواندن پست‌ها" }).click();
  await expect(page.getByText("یک ورود از پست‌ها در حال انجام است؛ صبر کنید تمام شود.")).toBeVisible();
});

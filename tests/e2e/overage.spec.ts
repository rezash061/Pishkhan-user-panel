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

const card = (page: Page) => page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: "مصرف مازاد" }) });

test.afterEach(async ({ request }) => {
  await request.post(`${mock}/__mock/overage?scenario=trial`);
});

test("a trial has no overage: the AI stops at the limit and upgrading is offered", async ({ page, request }) => {
  await request.post(`${mock}/__mock/overage?scenario=trial`);
  await login(page);
  await page.goto(`${base}/billing`);
  await expect(card(page)).toContainText("این طرح مصرف مازاد ندارد");
  await expect(card(page).getByRole("link", { name: "دیدن طرح‌ها" })).toBeVisible();
  await expect(card(page).getByRole("switch")).toHaveCount(0);
});

test("overage: usage beyond the plan, its cost, and the cap setting", async ({ page, request }) => {
  await request.post(`${mock}/__mock/overage?scenario=overage`);
  await login(page);
  await page.goto(`${base}/billing`);
  const c = card(page);
  await expect(c.getByText("مصرف مازاد", { exact: true }).last()).toBeVisible();
  await expect(c).toContainText("۱٬۱۵۰ از ۱٬۰۰۰");
  await expect(c).toContainText("۱۵۰گفتگوی مازاد");
  await expect(c).toContainText("۵٬۰۰۰ تومانقیمت هر گفتگو");
  await expect(c).toContainText("۷۵۰٬۰۰۰ تومانهزینهٔ مازاد تا امروز");
  await expect(c).toContainText("۷۵۰٬۰۰۰ تومان از ۸۹۰٬۰۰۰ تومان");
  await expect(c).toContainText("پیش‌فرض: ۸۹۰٬۰۰۰ تومان (قیمت ماهانهٔ طرح)");
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  // A custom cap is checked against 10× the monthly price before saving.
  await c.getByRole("radio", { name: "مبلغ دلخواه" }).click();
  await c.getByLabel("سقف هزینهٔ مازاد در هر دوره (تومان)").fill("۹۰۰۰۰۰۰");
  await expect(c.getByText("سقف باید بین صفر و ۸٬۹۰۰٬۰۰۰ تومان باشد.")).toBeVisible();
  await expect(c.getByRole("button", { name: "ذخیرهٔ تنظیمات مازاد" })).toBeDisabled();
  await c.getByLabel("سقف هزینهٔ مازاد در هر دوره (تومان)").fill("۵۰۰۰۰۰");
  await c.getByRole("button", { name: "ذخیرهٔ تنظیمات مازاد" }).click();
  await expect(page.getByText("تنظیمات مصرف مازاد ذخیره شد.")).toBeVisible();
  // 750,000 Toman of overage against a 500,000 cap: new conversations go to the team.
  await expect(c).toContainText("سقف مازاد پر شد");
  await expect(c).toContainText("گفتگوهای تازه تا پایان دوره به تیم شما سپرده می‌شوند");

  await c.getByRole("switch", { name: "ادامهٔ پاسخ هوش مصنوعی بعد از سقف طرح" }).click();
  await c.getByRole("button", { name: "ذخیرهٔ تنظیمات مازاد" }).click();
  await expect(c).toContainText("سقف طرح پر شد");
});

test("an unpaid charge blocks the AI: banners on the dashboard and billing, pay through Zarinpal, then it lifts", async ({ page, request }) => {
  await request.post(`${mock}/__mock/overage?scenario=unpaid`);
  await login(page);
  const banner = page.getByRole("alert").filter({ hasText: "پاسخ هوش مصنوعی بیرون از طرح متوقف شده است" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("۳۲۰٬۰۰۰ تومان");
  await banner.getByRole("link", { name: "پرداخت مازاد" }).click();
  await expect(page).toHaveURL(`${base}/billing`);

  const c = card(page);
  await expect(c).toContainText("مازاد پرداخت‌نشده");
  await expect(c.getByRole("row", { name: /پرداخت‌نشده/ })).toContainText("۶۴");
  await expect(c.getByRole("row", { name: /پرداخت‌شده/ })).toBeVisible();
  await page.getByRole("alert").getByRole("button", { name: "پرداخت ۳۲۰٬۰۰۰ تومان" }).click();
  await page.waitForURL(`${mock}/__mock/zarinpal/**`);
  await page.getByRole("link", { name: "پرداخت", exact: true }).click();
  await page.waitForURL(new RegExp(`${base}/billing/checkouts/[0-9a-f-]{36}`));
  await expect(page.getByText("پرداخت موفق بود")).toBeVisible();
  await expect(page.getByText(/بدهی مصرف مازاد پرداخت شد/)).toBeVisible();
  await expect(page.getByText("پرداخت مصرف مازاد", { exact: true })).toBeVisible();

  await page.goto(base);
  await expect(page.getByText("پاسخ هوش مصنوعی بیرون از طرح متوقف شده است")).toHaveCount(0);
  await page.goto(`${base}/billing`);
  await expect(card(page).getByRole("row", { name: /پرداخت‌نشده/ })).toHaveCount(0);
});

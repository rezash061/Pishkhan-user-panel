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

const planCard = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true, level: 3 }) });

/** Picks a plan, checks the quote, pays at the stand-in Zarinpal page with `choice` and lands on the checkout page. */
async function buy(page: Page, plan: string, action: string, choice: string) {
  await planCard(page, plan).getByRole("button", { name: action }).click();
  const dialog = page.getByRole("dialog");
  const pay = dialog.getByRole("button", { name: /^پرداخت / });
  await expect(pay).toBeEnabled();
  await pay.click();
  await page.waitForURL(`${mock}/__mock/zarinpal/**`);
  await page.getByRole("link", { name: choice }).click();
  await page.waitForURL(new RegExp(`${base}/billing/checkouts/[0-9a-f-]{36}`));
}

test.beforeEach(async ({ request }) => {
  await request.post(`${mock}/__mock/billing/reset`);
});

test("buys a plan through Zarinpal, then sees the invoice in the history", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/billing`);
  await expect(page.getByRole("heading", { name: "طرح‌ها" })).toBeVisible();
  // During a trial every paid plan is a new purchase; the free plan is the current one.
  await expect(planCard(page, "رایگان").getByText("طرح فعلی")).toBeVisible();
  await expect(planCard(page, "رشد").getByText(/خرید تازه:/)).toBeVisible();
  await expect(planCard(page, "رشد")).toContainText("۸۹۰٬۰۰۰ تومان");

  await page.getByRole("radio", { name: "سالانه" }).click();
  await expect(planCard(page, "رشد")).toContainText("۸٬۹۰۰٬۰۰۰ تومان");
  await expect(planCard(page, "رشد")).toContainText("۱۷٪ صرفه‌جویی");
  // «حرفه‌ای» has no annual price: it stays monthly and says so.
  await expect(planCard(page, "حرفه‌ای")).toContainText("فقط ماهانه");
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  await planCard(page, "رشد").getByRole("button", { name: "خرید" }).click();
  const dialog = page.getByRole("dialog", { name: "خرید تازه طرح رشد" });
  await expect(dialog.getByText("قیمت طرح (سالانه (۳۶۵ روز))")).toBeVisible();
  await expect(dialog.getByText("از همین حالا", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "پرداخت ۸٬۹۰۰٬۰۰۰ تومان" })).toBeVisible();
  await dialog.getByRole("button", { name: "انصراف" }).click();

  await page.getByRole("radio", { name: "ماهانه" }).click();
  await buy(page, "رشد", "خرید", "پرداخت");
  await expect(page.getByText("پرداخت موفق بود")).toBeVisible();
  await expect(page.getByText("طرح رشد (ماهانه) فعال شد.")).toBeVisible();
  await expect(page.getByText("۱۰۰۱", { exact: true })).toBeVisible();
  await expect(page.getByText("۷۰۰۰۱۰۰۱", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "چاپ فاکتور" })).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "بازگشت به اشتراک" }).click();
  await expect(page.getByText("دورهٔ پرداخت: ماهانه")).toBeVisible();
  // On «رشد» now: same plan renews, a bigger one upgrades, a smaller one downgrades.
  await expect(planCard(page, "رشد").getByRole("button", { name: "تمدید" })).toBeVisible();
  await expect(planCard(page, "حرفه‌ای").getByRole("button", { name: "ارتقا" })).toBeVisible();
  await expect(planCard(page, "پایه").getByRole("button", { name: "تغییر به این طرح" })).toBeVisible();
  const history = page.getByRole("link", { name: /فاکتور ۱۰۰۱/ });
  await expect(history).toContainText("پرداخت‌شده");
  await expect(history).toContainText("۸۹۰٬۰۰۰ تومان");

  // An upgrade is credited with the unused part of the current period.
  await planCard(page, "حرفه‌ای").getByRole("button", { name: "ارتقا" }).click();
  const upgrade = page.getByRole("dialog", { name: "ارتقا طرح حرفه‌ای" });
  await expect(upgrade.getByText("اعتبار باقی‌ماندهٔ دورهٔ فعلی")).toBeVisible();
});

test("a cancelled payment and a pending one that is confirmed later", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/billing`);
  await buy(page, "پایه", "خرید", "انصراف");
  await expect(page.getByText("پرداخت لغو شد")).toBeVisible();
  await page.getByRole("link", { name: "انتخاب دوبارهٔ طرح" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/billing$`));

  await buy(page, "رشد", "خرید", "بدون پاسخ (در انتظار)");
  await expect(page.getByText("در انتظار تأیید درگاه")).toBeVisible();
  const id = page.url().match(/checkouts\/([0-9a-f-]{36})/)![1];
  await page.request.post(`${mock}/__mock/billing/checkouts/${id}/settle?outcome=paid`);
  await page.getByRole("button", { name: "بررسی دوباره" }).click();
  await expect(page.getByText("پرداخت موفق بود")).toBeVisible();

  // A renewal paid now starts when the current period ends and shows as an upcoming period.
  await page.goto(`${base}/billing`);
  await buy(page, "رشد", "تمدید", "پرداخت");
  await expect(page.getByText(/طرح رشد \(ماهانه\) از .* شروع می‌شود\./)).toBeVisible();
  await page.goto(`${base}/billing`);
  await expect(page.getByText("دوره‌های پرداخت‌شدهٔ بعدی")).toBeVisible();
  await expect(page.getByRole("link", { name: /بدون فاکتور/ })).toContainText("ناموفق");
  // An upgrade is refused while a later period is already paid for.
  await expect(planCard(page, "حرفه‌ای")).toContainText("یک دورهٔ بعدی از قبل پرداخت شده است");
});

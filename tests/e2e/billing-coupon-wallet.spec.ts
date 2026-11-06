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

const planCard = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true, level: 3 }) });
const walletCard = (page: Page) => page.locator("#wallet");

test.beforeEach(async ({ request }) => {
  await request.post(`${mock}/__mock/billing/reset`);
});

test("a coupon: refused codes are explained, a good one takes its discount off", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/billing`);
  await planCard(page, "رشد").getByRole("button", { name: "خرید" }).click();
  const dialog = page.getByRole("dialog", { name: "خرید تازه طرح رشد" });
  await expect(dialog.getByRole("button", { name: "پرداخت ۸۹۰٬۰۰۰ تومان" })).toBeVisible();

  await dialog.getByRole("button", { name: "کد تخفیف دارید؟" }).click();
  const field = dialog.getByLabel("کد تخفیف");
  await field.fill("pro20");
  await dialog.getByRole("button", { name: "اعمال" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("این کد تخفیف برای این طرح نیست.");
  // The quote without the coupon stays.
  await expect(dialog.getByRole("button", { name: "پرداخت ۸۹۰٬۰۰۰ تومان" })).toBeVisible();
  await field.fill("old");
  await dialog.getByRole("button", { name: "اعمال" }).click();
  await expect(dialog.getByRole("alert")).toContainText("مهلت این کد تخفیف تمام شده");
  await field.fill("nope");
  await dialog.getByRole("button", { name: "اعمال" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("این کد تخفیف معتبر نیست.");

  await field.fill("norooz");
  await dialog.getByRole("button", { name: "اعمال" }).click();
  await expect(dialog.getByText("کد تخفیف اعمال شد:")).toBeVisible();
  await expect(dialog.getByText("کد تخفیف NOROOZ")).toBeVisible();
  await expect(dialog.getByText("− ۸۹٬۰۰۰ تومان")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "پرداخت ۸۰۱٬۰۰۰ تومان" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  // Removing it puts the full price back.
  await dialog.getByRole("button", { name: "حذف کد" }).click();
  await expect(dialog.getByRole("button", { name: "پرداخت ۸۹۰٬۰۰۰ تومان" })).toBeVisible();
  // The field stays open, empty, for another code.
  await expect(dialog.getByLabel("کد تخفیف")).toHaveValue("");
  await dialog.getByLabel("کد تخفیف").fill("NOROOZ");
  await dialog.getByRole("button", { name: "اعمال" }).click();
  await dialog.getByRole("button", { name: "پرداخت ۸۰۱٬۰۰۰ تومان" }).click();
  await page.waitForURL(`${mock}/__mock/zarinpal/**`);
  await page.getByRole("link", { name: "پرداخت" }).click();
  await page.waitForURL(new RegExp(`${base}/billing/checkouts/[0-9a-f-]{36}`));
  await expect(page.getByText("پرداخت موفق بود")).toBeVisible();
  await expect(page.getByText("تخفیف", { exact: true })).toBeVisible();
  await expect(page.getByText("NOROOZ")).toBeVisible();
  await expect(page.getByText("پرداخت در درگاه")).toBeVisible();
});

test("the wallet: top up through Zarinpal, then pay part of a plan and a whole one from it", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/billing`);
  const wallet = walletCard(page);
  await expect(page.getByTestId("wallet-balance")).toHaveText("۰ تومان");
  await expect(page.getByText("هنوز تراکنشی در کیف پول نیست.")).toBeVisible();
  // No balance: the quote does not offer the wallet.
  await planCard(page, "رشد").getByRole("button", { name: "خرید" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^پرداخت / })).toBeEnabled();
  await expect(page.getByRole("dialog").getByText(/پرداخت از کیف پول/)).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "انصراف" }).click();

  await wallet.getByRole("button", { name: "افزایش موجودی" }).click();
  const topUp = page.getByRole("dialog", { name: "افزایش موجودی کیف پول" });
  await topUp.getByRole("textbox", { name: "مبلغ" }).fill("5000");
  await topUp.getByRole("button", { name: /^پرداخت/ }).click();
  await expect(topUp.getByRole("alert")).toHaveText("کمترین مبلغ ۱۰٬۰۰۰ تومان است.");
  await topUp.getByRole("button", { name: "۵۰۰٬۰۰۰ تومان" }).click();
  await topUp.getByRole("button", { name: "پرداخت ۵۰۰٬۰۰۰ تومان" }).click();
  await page.waitForURL(`${mock}/__mock/zarinpal/**`);
  await page.getByRole("link", { name: "پرداخت" }).click();
  await page.waitForURL(new RegExp(`${base}/billing/checkouts/[0-9a-f-]{36}`));
  await expect(page.getByText("۵۰۰٬۰۰۰ تومان به موجودی کیف پول اضافه شد.")).toBeVisible();
  await expect(page.getByText("شارژ کیف پول")).toBeVisible();

  await page.goto(`${base}/billing`);
  await expect(page.getByTestId("wallet-balance")).toHaveText("۵۰۰٬۰۰۰ تومان");
  await expect(walletCard(page).getByRole("listitem").first()).toContainText("+ ۵۰۰٬۰۰۰ تومان");

  // Part of «رشد» from the wallet, the rest at Zarinpal.
  await planCard(page, "رشد").getByRole("button", { name: "خرید" }).click();
  const dialog = page.getByRole("dialog", { name: "خرید تازه طرح رشد" });
  await dialog.getByRole("switch", { name: /پرداخت از کیف پول/ }).click();
  await expect(dialog.getByText("از کیف پول", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "پرداخت ۳۹۰٬۰۰۰ تومان" })).toBeVisible();
  // A failed payment gives the wallet part back.
  await dialog.getByRole("button", { name: "پرداخت ۳۹۰٬۰۰۰ تومان" }).click();
  await page.waitForURL(`${mock}/__mock/zarinpal/**`);
  await page.getByRole("link", { name: "انصراف" }).click();
  await page.waitForURL(new RegExp(`${base}/billing/checkouts/[0-9a-f-]{36}`));
  await expect(page.getByText("پرداخت لغو شد")).toBeVisible();
  await page.goto(`${base}/billing`);
  await expect(page.getByTestId("wallet-balance")).toHaveText("۵۰۰٬۰۰۰ تومان");
  await expect(walletCard(page).getByText("برگشت به کیف پول")).toBeVisible();

  // «پایه» costs 390,000 Toman: the wallet pays it all and there is no gateway.
  await planCard(page, "پایه").getByRole("button", { name: "خرید" }).click();
  const basic = page.getByRole("dialog", { name: "خرید تازه طرح پایه" });
  await basic.getByRole("switch", { name: /پرداخت از کیف پول/ }).click();
  await expect(basic.getByText("مبلغ قابل پرداخت در درگاه")).toBeVisible();
  await expect(basic.getByText(/به درگاه نمی‌روید/)).toBeVisible();
  await basic.getByRole("button", { name: "پرداخت و فعال‌سازی" }).click();
  await page.waitForURL(new RegExp(`${base}/billing/checkouts/[0-9a-f-]{36}`));
  await expect(page.getByText("پرداخت موفق بود")).toBeVisible();
  await expect(page.getByText("طرح پایه (ماهانه) فعال شد.")).toBeVisible();
  await expect(page.getByText("پرداخت از کیف پول")).toBeVisible();
  await page.goto(`${base}/billing`);
  await expect(page.getByTestId("wallet-balance")).toHaveText("۱۱۰٬۰۰۰ تومان");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const workspaceId = "0199b000-0000-7000-8000-0000000000aa";
const base = `/w/${workspaceId}`;
const mock = "http://localhost:5080";
const niloofar = "0199b000-0000-7000-8000-000000001000";
const awaitingOrder = "0199b000-0000-7000-a000-0000000000f1";

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

// A 1×1 PNG: enough for the upload, the scan and the receipt.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test.afterEach(async ({ request }) => {
  await request.post(`${mock}/__mock/receipts?scenario=reset`);
});

test("payment settings: bank accounts checked before sending, and auto-approve closed until the platform allows it", async ({ page, request }) => {
  await request.post(`${mock}/__mock/receipts?scenario=reset`);
  await login(page);
  await page.goto(`${base}/settings/payments`);
  await expect(page.getByText("هنوز حسابی ثبت نکرده‌اید.")).toBeVisible();

  await page.getByRole("button", { name: "افزودن حساب" }).click();
  const dialog = page.getByRole("dialog", { name: "حساب تازه" });
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  await expect(dialog.getByText("شمارهٔ کارت یا شبا را بنویسید.")).toBeVisible();
  await dialog.getByLabel("شمارهٔ کارت").fill("۶۰۳۷ ۹۹۱۲ ۳۴۵۶ ۷۸۹۴");
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  await expect(dialog.getByText("شمارهٔ کارت درست نیست؛ ۱۶ رقم را دوباره بررسی کنید.")).toBeVisible();
  await dialog.getByLabel("شمارهٔ کارت").fill("۶۰۳۷ ۹۹۱۲ ۳۴۵۶ ۷۸۹۳");
  await dialog.getByLabel("شمارهٔ شبا").fill("IR82 0540 1026 8002 0817 9090 03");
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  await expect(dialog.getByText("شمارهٔ شبا درست نیست؛ IR و ۲۴ رقم را دوباره بررسی کنید.")).toBeVisible();
  await dialog.getByLabel("شمارهٔ شبا").fill("");
  await dialog.getByLabel("نام صاحب حساب (اختیاری)").fill("پارسا رضایی");
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("حساب ذخیره شد.")).toBeVisible();
  await expect(page.getByText("6037-9912-3456-7893")).toBeVisible();
  await expect(page.getByText("بانک ملی ایران")).toBeVisible();

  const settings = page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: "بررسی رسیدها" }) });
  await expect(settings.getByRole("switch", { name: "تأیید خودکار رسیدهایی که همهٔ بررسی‌ها را می‌گذرانند" })).toBeDisabled();
  await expect(settings.getByText("تأیید خودکار هنوز در دسترس نیست")).toBeVisible();
  await settings.getByLabel("مهلت واریز بعد از ثبت سفارش (ساعت)").fill("۹۰۰");
  await expect(settings.getByText("عددی بین ۱ تا ۷۲۰ بنویسید.")).toBeVisible();
  await expect(settings.getByRole("button", { name: "ذخیرهٔ تنظیمات رسید" })).toBeDisabled();
  await settings.getByLabel("مهلت واریز بعد از ثبت سفارش (ساعت)").fill("۴۸");
  await settings.getByRole("button", { name: "ذخیرهٔ تنظیمات رسید" }).click();
  await expect(page.getByText("تنظیمات رسید ذخیره شد.")).toBeVisible();
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("receipts queue: the checks in words, approve pays the order, and an automatic duplicate can still be approved", async ({ page, request }) => {
  await request.post(`${mock}/__mock/receipts?scenario=seed`);
  await login(page);
  await page.goto(`${base}/orders`);
  await page.getByRole("link", { name: "رسیدها" }).click();
  await expect(page).toHaveURL(`${base}/orders/receipts`);
  await expect(page.getByRole("tab", { name: "منتظر بررسی" })).toHaveAttribute("aria-selected", "true");
  const row = page.getByRole("button", { name: /۲٬۴۰۰٬۰۰۰ تومان/ });
  await expect(row).toContainText("ایراد: مبلغ برابر جمع سفارش");
  await noHorizontalScroll(page);
  let axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  await row.click();
  const dialog = page.getByRole("dialog", { name: "رسید کارت به کارت" });
  await expect(dialog.getByRole("img", { name: "تصویر رسید" })).toBeVisible();
  await expect(dialog).toContainText("مبلغ برابر جمع سفارش: نادرست (کمتر از جمع سفارش)");
  await expect(dialog).toContainText("واریز به حساب شما: درست");
  await expect(dialog).toContainText("123456789012");
  axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await dialog.getByRole("button", { name: "تأیید رسید" }).click();
  await dialog.getByRole("button", { name: "تأیید و پرداخت‌شده کردن سفارش" }).click();
  await expect(page.getByText("رسید تأیید شد و سفارش پرداخت‌شده شد.")).toBeVisible();
  await expect(page.getByText("رسیدی منتظر بررسی نیست.")).toBeVisible();

  // The duplicate the backend rejected on its own is told apart, and can still be approved (here it is only looked at).
  await page.getByRole("tab", { name: "ردشده" }).click();
  await expect(page.getByText("تکراری (رد خودکار)")).toBeVisible();
  await page.getByRole("button", { name: /۹۹۰٬۰۰۰ تومان/ }).click();
  const dup = page.getByRole("dialog", { name: "رسید کارت به کارت" });
  await expect(dup).toContainText("تکراری نبودن: نادرست (همین شمارهٔ پیگیری قبلاً آمده)");
  await expect(dup.getByRole("link", { name: "دیدن رسید قبلی" })).toBeVisible();
  await expect(dup.getByRole("button", { name: "تأیید رسید" })).toBeVisible();
  await expect(dup.getByRole("button", { name: "رد رسید" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // The order is paid now, and its page lists the receipt.
  await page.goto(`${base}/orders/${awaitingOrder}`);
  await expect(page.getByText("پرداخت‌شده").first()).toBeVisible();
  const card = page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: "رسیدهای کارت به کارت" }) });
  await expect(card).toContainText("تأییدشده");
});

test("a receipt is rejected with a reason; the inbox marks a customer's image as a receipt once", async ({ page, request }) => {
  await request.post(`${mock}/__mock/receipts?scenario=seed`);
  await login(page);
  await page.goto(`${base}/orders/receipts`);
  await page.getByRole("button", { name: /۲٬۴۰۰٬۰۰۰ تومان/ }).click();
  const dialog = page.getByRole("dialog", { name: "رسید کارت به کارت" });
  await dialog.getByRole("button", { name: "رد رسید" }).click();
  await dialog.getByRole("button", { name: "رد رسید" }).click();
  await expect(dialog.getByText("دلیل را بنویسید.")).toBeVisible();
  await dialog.getByLabel("دلیل رد").fill("مبلغ کمتر از جمع سفارش است");
  await dialog.getByRole("button", { name: "رد رسید" }).click();
  await expect(page.getByText("رسید رد شد.")).toBeVisible();

  await page.goto(`${base}/inbox/${niloofar}`);
  const mark = page.getByRole("button", { name: "ثبت به‌عنوان رسید" });
  await expect(mark).toHaveCount(1);
  await mark.click();
  await expect(page.getByText("رسید ثبت شد و در حال بررسی است.")).toBeVisible();
  await mark.click();
  await expect(page.getByText("این رسید قبلاً ثبت شده است.")).toBeVisible();
});

test("a receipt uploaded on the order page is scanned, submitted and opened in the queue", async ({ page, request }) => {
  await request.post(`${mock}/__mock/receipts?scenario=seed`);
  await login(page);
  await page.goto(`${base}/orders/${awaitingOrder}`);
  const card = page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: "رسیدهای کارت به کارت" }) });
  await card.getByRole("button", { name: "ثبت رسید" }).click();
  const dialog = page.getByRole("dialog", { name: "ثبت رسید" });
  await dialog.getByRole("button", { name: "ثبت" }).click();
  await expect(dialog.getByText("فایل رسید را انتخاب کنید.")).toBeVisible();
  await dialog.getByLabel("فایل رسید").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await dialog.getByRole("button", { name: "ثبت" }).click();
  await expect(page).toHaveURL(/\/orders\/receipts\?status=all&receipt=/);
  const opened = page.getByRole("dialog", { name: "رسید کارت به کارت" });
  await expect(opened).toContainText("خواندن رسید: نامشخص (خواندن خودکار انجام نشد)");
  await expect(opened.getByRole("link", { name: "دیدن سفارش" })).toBeVisible();
});

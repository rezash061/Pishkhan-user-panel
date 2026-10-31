import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const workspaceId = "0199b000-0000-7000-8000-0000000000aa";
const base = `/w/${workspaceId}`;
// The mock keeps state between tests: unique names per run.
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

test("creates a DM keyword rule with the Persian keyword preview", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations/rules/new`);
  await page.getByLabel("نام قانون").fill(`قیمت ${run}`);
  const keywords = page.getByLabel("کلمه‌ها");
  await keywords.fill("قیمت");
  await keywords.press("Enter");
  // Arabic yeh spelling is shown as also matching, and the tester agrees with the backend matcher.
  await expect(page.getByText("قيمت", { exact: false }).first()).toBeVisible();
  await page.getByLabel("امتحان با یک پیام").fill("قيمت اين چنده؟");
  await expect(page.getByRole("status").filter({ hasText: "این پیام قانون را اجرا می‌کند." })).toBeVisible();

  await page.getByRole("button", { name: "افزودن کار" }).click();
  await page.getByRole("button", { name: /فرستادن پیام/ }).click();
  await page.locator("#action-0-message").fill("سلام {{contact.first_name}}، قیمت ۸۹۰ هزار تومانه");
  await expect(page.getByText("سلام سارا، قیمت ۸۹۰ هزار تومانه")).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "ساختن قانون" }).click();
  await page.waitForURL(/\/automations\/rules\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: `قیمت ${run}` })).toBeVisible();

  await page.goto(`${base}/automations`);
  await expect(page.getByText(`قیمت ${run}`)).toBeVisible();
});

test("shows rule errors next to the field before saving", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations/rules/new?trigger=dm_keyword`);
  await page.getByRole("button", { name: "ساختن قانون" }).click();
  await expect(page.getByText("دست‌کم یک کلمه بنویسید.")).toBeVisible();
  await expect(page.getByText("دست‌کم یک و حداکثر ۱۰ کار تعریف کنید.")).toBeVisible();
});

test("comment-to-DM wizard creates a rule and replies to old comments", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations/comments/new`);
  await page.getByRole("radio", { name: /مانتو کتان/ }).click();
  await page.getByRole("button", { name: "ادامه" }).click();
  const keywords = page.getByLabel("کلمه‌ها");
  await keywords.fill(`کد${run}`);
  await keywords.press("Enter");
  await page.getByRole("button", { name: "ادامه" }).click();
  await expect(page.locator("#wizard-dm")).toHaveValue(/ممنون از کامنتتون/);
  await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByRole("button", { name: "ساختن" }).click();
  await page.waitForURL(/\/automations\/rules\/[0-9a-f-]{36}$/);
  await expect(page.getByText("جواب به کامنت‌های قبلی")).toBeVisible();
  await expect(page.getByText(/کامنت بررسی شد/)).toBeVisible();
});

test("builds, validates and publishes a flow", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations/flows`);
  await page.getByRole("button", { name: "سناریوی تازه" }).click();
  await page.waitForURL(/\/automations\/flows\/[0-9a-f-]{36}$/);
  await page.getByLabel("نام سناریو").fill(`سایز ${run}`);

  // Insert a question after the welcome message, leave it empty: the server flags it.
  await page.getByLabel("start: بعد").selectOption("__new");
  await page.getByRole("button", { name: /^سؤال/ }).click();
  await page.getByRole("button", { name: "تمام", exact: true }).click();
  await page.getByRole("button", { name: "انتشار" }).click();
  await expect(page.getByText("متن سؤال را بنویسید.")).toBeVisible();

  await page.getByRole("button", { name: "ویرایش question_1" }).click();
  await page.locator("#node-question_1-prompt").fill("سایزتون چنده؟");
  await page.getByRole("button", { name: "تمام", exact: true }).click();
  await page.getByRole("button", { name: "انتشار" }).click();
  await expect(page.getByText("منتشرشده (نسخهٔ ۱)")).toBeVisible();
  await noHorizontalScroll(page);

  // Chat with the flow: it asks, waits, and finishes after an answer.
  await page.getByRole("button", { name: "تست", exact: true }).click();
  const tester = page.getByRole("dialog");
  await expect(tester.getByText("سایزتون چنده؟")).toBeVisible();
  await expect(tester.getByText("منتظر جواب مشتری")).toBeVisible();
  await tester.getByLabel("جواب مشتری").fill("M");
  await tester.getByRole("button", { name: "فرستادن" }).click();
  await expect(tester.getByText("سناریو تمام شد")).toBeVisible();
});

test("tests a rule against a sample comment without sending anything", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations`);
  await page.getByRole("link", { name: /قیمت زیر پست/ }).click();
  await page.getByRole("button", { name: "تست این قانون" }).click();
  const tester = page.getByRole("dialog");
  await expect(tester.getByLabel("متن")).toHaveValue("قیمت");
  await tester.getByRole("button", { name: "اجرای تست" }).click();
  await expect(tester.getByText("قانون «قیمت زیر پست» جواب می‌دهد.")).toBeVisible();
  await expect(tester.getByText(/سلام عزیز 🌸 قیمت مانتو کتان/)).toBeVisible();
  await expect(tester.getByText(/پاسخ زیر کامنت/)).toBeVisible();
  await noHorizontalScroll(page);
});

test("automation settings show the workspace business hours", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/automations/settings`);
  await expect(page.getByRole("link", { name: "ویرایش ساعت کاری" })).toHaveAttribute("href", `${base}/settings/business-hours`);
  await expect(page.getByText("شنبه").first()).toBeVisible();
});

test("adds a product with size variants and Toman prices", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/catalog/products/new`);
  await page.getByLabel("نام محصول").fill(`شومیز ${run}`);
  await page.locator("#p-price").fill("۷۵۰۰۰۰");
  await expect(page.locator("#p-price")).toHaveValue("۷۵۰٬۰۰۰");
  await page.getByRole("switch", { name: "این محصول مدل‌های مختلف دارد" }).click();
  const values = page.locator("#option-0");
  await values.fill("M");
  await values.press("Enter");
  await values.fill("L");
  await values.press("Enter");
  await expect(page.getByRole("cell", { name: "M", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "L", exact: true })).toBeVisible();
  await page.getByLabel("L قیمت").fill("820000");
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "افزودن محصول" }).click();
  await page.waitForURL(/\/catalog\/products\/[0-9a-f-]{36}$/);

  // On a saved product an image is stored at once, without pressing Save.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"][accept^="image"]').setInputFiles({ name: "front.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("اصلی", { exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "در حال بارگذاری" })).toHaveCount(0, { timeout: 10_000 });
  await page.reload();
  await expect(page.getByText("اصلی", { exact: true })).toBeVisible();

  await page.goto(`${base}/catalog`);
  const row = page.getByRole("link", { name: new RegExp(`شومیز ${run}`) });
  await expect(row).toContainText("۷۵۰٬۰۰۰ تا ۸۲۰٬۰۰۰ تومان");
});

test("builds a storefront card set and previews it", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/catalog/storefront-cards`);
  await page.getByRole("button", { name: "مجموعهٔ تازه" }).click();
  await page.getByLabel("نام مجموعه").fill(`پرفروش ${run}`);
  await page.getByRole("button", { name: /مانتو کتان تابستانه/ }).click();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await page.getByRole("button", { name: `پیش‌نمایش پرفروش ${run}` }).click();
  await expect(page.getByRole("dialog").getByText("مانتو کتان تابستانه")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("سفارش")).toBeVisible();
});

test("imports products from Excel", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/catalog`);
  await page.getByRole("button", { name: "ورود از اکسل" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "catalog.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("PK mock") });
  await expect(page.getByText("۱۲ ردیف: ۹ تازه، ۲ به‌روز، ۱ ردشده.")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("cell", { name: "قیمت نامعتبر است." })).toBeVisible();
});

test("automation and catalog pages pass an accessibility scan", async ({ page }) => {
  await login(page);
  for (const path of ["/automations", "/automations/rules/new?trigger=comment_keyword", "/catalog", "/catalog/products/new"]) {
    await page.goto(`${base}${path}`);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
    expect(results.violations.map((v) => `${path}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  }
});

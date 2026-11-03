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

const gaugeValue = async (page: Page) => Number(await page.getByRole("meter", { name: "امتیاز دانش" }).first().getAttribute("aria-valuenow"));

test.beforeEach(async ({ request }) => {
  await request.post(`${mock}/__mock/knowledge/reset-facts`);
});

test("score page: gauge, parts, facts checklist, products and suggestions", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/knowledge`);
  await page.getByRole("link", { name: "امتیاز دانش" }).click();
  await expect(page).toHaveURL(`${base}/knowledge/score`);
  await expect(page.getByRole("meter", { name: "امتیاز دانش" })).toHaveAttribute("aria-valuetext", /از ۱۰۰/);
  await expect(page.getByText("اطلاعات ضروری صنف", { exact: true })).toBeVisible();
  await expect(page.getByText(/^\S+ از ۶۰$/)).toBeVisible();
  await expect(page.getByText("۱ از ۸ جواب داده شده")).toBeVisible();

  // The covered fact links to its source; a missing one offers «پاسخ بده».
  const covered = page.getByRole("listitem").filter({ hasText: "زمان ارسال" });
  await expect(covered.getByRole("link", { name: "مشاهدهٔ جواب" })).toBeVisible();
  const missing = page.getByRole("listitem").filter({ hasText: "هزینه ارسال" });
  await expect(missing.getByRole("link", { name: "پاسخ بده" })).toHaveAttribute("href", `${base}/knowledge/interview?fact=shipping_cost`);
  await expect(page.getByText("قیمت‌دار")).toBeVisible();
  await expect(page.getByRole("link", { name: /موجودی محصولات را به‌روز کنید/ })).toHaveAttribute("href", `${base}/catalog`);
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  // The source opens from the checklist, and sources show the fact they answer.
  await covered.getByRole("link", { name: "مشاهدهٔ جواب" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("جواب «زمان ارسال»")).toBeVisible();
});

test("interview: answer, AI draft, edit, confirm and the score rises; skip moves on", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/knowledge/score`);
  const before = await gaugeValue(page);
  await page.getByRole("listitem").filter({ hasText: "هزینه ارسال" }).getByRole("link", { name: "پاسخ بده" }).click();
  await expect(page.getByRole("heading", { name: "آموزش دستیار" })).toBeVisible();

  // The fact picked on the score page is asked first, as the assistant's question.
  const question = page.locator("#interview-question");
  await expect(question).toContainText("هزینه ارسال به تهران و شهرستان‌ها چقدر است");
  await page.getByLabel("جواب شما برای «هزینه ارسال»").fill("تهران ۵۰ تومن، شهرستان ۷۰، بالای یک میلیون رایگان");
  await page.getByRole("button", { name: "فرستادن" }).click();
  await expect(page.getByText("هوش مصنوعی پیش‌نویس کرد")).toBeVisible();
  await expect(page.getByLabel("سؤال مشتری")).toHaveValue("هزینه ارسال چقدره؟");
  await page.getByLabel("جواب", { exact: true }).fill("ارسال تهران ۵۰ هزار تومان و شهرستان ۷۰ هزار تومان است؛ بالای یک میلیون تومان رایگان.");
  await page.getByRole("button", { name: "تأیید و ذخیره" }).click();
  await expect(page.getByText("«هزینه ارسال» ذخیره شد")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /امتیاز از .* به .* رسید/ })).toBeVisible();
  expect(await gaugeValue(page)).toBeGreaterThan(before);

  // The next fact; skip it.
  const next = (await question.textContent()) ?? "";
  await page.getByRole("button", { name: "رد شدن" }).click();
  await expect(question).not.toHaveText(next);

  // Without a model the owner's words are kept, labelled as their own text.
  await page.getByLabel(/^جواب شما برای/).fill("بدون هوش: کارت به کارت و درگاه");
  await page.getByRole("button", { name: "فرستادن" }).click();
  await expect(page.getByText("از متن خودتان")).toBeVisible();
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  await page.getByRole("link", { name: "بازگشت به امتیاز دانش" }).click();
  await expect(page.getByText("۲ از ۸ جواب داده شده")).toBeVisible();
});

test("onboarding: after Instagram and the template, the teach step runs the interview", async ({ page }) => {
  await login(page);
  await page.goto(`/onboarding/connect?ws=${workspaceId}`);
  await page.getByRole("link", { name: "بعداً وصل می‌کنم" }).click();
  await page.waitForURL(`**/onboarding/template?ws=${workspaceId}`);
  await page.getByRole("link", { name: "فعلاً نه، ادامه" }).click();
  await page.waitForURL(`**/onboarding/teach?ws=${workspaceId}`);
  await expect(page.getByRole("heading", { name: "به دستیار یاد بدهید" })).toBeVisible();
  await expect(page.getByText("مرحلهٔ ۴ از ۴")).toBeVisible();
  await expect(page.locator("#interview-question")).toBeVisible();
  await page.getByRole("link", { name: "بعداً، رفتن به پیشخوان" }).click();
  await page.waitForURL(`**${base}`);
});

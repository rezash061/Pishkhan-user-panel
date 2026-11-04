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

test.beforeEach(async ({ request }) => {
  await request.post(`${mock}/__mock/templates/reset`);
});

test("onboarding: previews the clothing template, applies it and links to the blanks", async ({ page }) => {
  await login(page);
  await page.goto(`/onboarding/connect?ws=${workspaceId}`);
  await page.getByRole("link", { name: "بعداً وصل می‌کنم" }).click();
  await page.waitForURL(`**/onboarding/template?ws=${workspaceId}`);
  await expect(page.getByRole("heading", { name: "با قالب صنف خود شروع کنید" })).toBeVisible();
  await expect(page.getByText("مرحلهٔ ۳ از ۵")).toBeVisible();

  // The workspace sells clothing: its template comes first, recommended and picked.
  const first = page.getByRole("radio").first();
  await expect(first).toBeChecked();
  await expect(first).toHaveAccessibleName(/^پوشاک و کیف و کفش\s*پیشنهادی برای صنف شما/);

  const preview = page.getByRole("region", { name: /آنچه «پوشاک و کیف و کفش» اضافه می‌کند/ });
  await expect(preview.getByText(/خاموش اضافه می‌شوند/)).toBeVisible();
  await preview.getByText("سؤال‌های رایج (۸)").click();
  await expect(preview.getByText("هزینه ارسال چقدره؟")).toBeVisible();
  await expect(preview.getByText(/\[مبلغ\] تومان/).first()).toBeVisible();
  await preview.getByText("قانون‌های پاسخ خودکار (۳)").click();
  await expect(preview.getByText("کلمه در کامنت").first()).toBeVisible();
  await preview.getByText("دستیار هوشمند").click();
  await expect(preview.getByText("دستیار فروشگاه")).toBeVisible();
  await expect(preview.getByText("صمیمی", { exact: true })).toBeVisible();
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  // Another template can be previewed before deciding.
  await page.getByRole("radio", { name: /^طلا و جواهر/ }).check({ force: true });
  await expect(page.getByRole("region", { name: /طلا و جواهر/ })).toBeVisible();
  await page.getByRole("radio", { name: /^پوشاک و کیف و کفش/ }).check({ force: true });

  await page.getByRole("button", { name: "اعمال قالب" }).click();
  const result = page.getByRole("status").filter({ hasText: "قالب «پوشاک و کیف و کفش» اعمال شد" });
  await expect(result).toContainText("۸ سؤال رایج (خاموش)");
  await expect(result).toContainText("۱ گفتگوی خودکار (منتشرشده)");
  await expect(result).toContainText("۳ قانون (خاموش)");
  await expect(result).toContainText("تنظیمات دستیار هوشمند");
  await expect(result.getByRole("link", { name: "دانش کسب‌وکار" })).toHaveAttribute("href", `${base}/knowledge`);
  // On to importing from posts.
  await page.getByRole("link", { name: "ادامه", exact: true }).click();
  await page.waitForURL(`**/onboarding/import?ws=${workspaceId}`);
});

test("settings: applying again adds nothing new and shows the history", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/settings/templates`);
  await expect(page.getByRole("heading", { name: "قالب صنف" })).toBeVisible();
  await expect(page.getByText("هنوز قالبی اعمال نشده است.")).toBeVisible();
  await page.getByRole("button", { name: "اعمال قالب" }).click();
  await expect(page.getByText("قالب «پوشاک و کیف و کفش» اعمال شد")).toBeVisible();
  await page.getByRole("button", { name: "بازگشت به قالب‌ها" }).click();
  await expect(page.getByText(/آخرین اعمال:/).first()).toBeVisible();
  await page.getByRole("button", { name: "اعمال دوباره" }).click();
  await expect(page.getByRole("status")).toContainText("چیز تازه‌ای اضافه نشد");
  await expect(page.getByRole("status")).toContainText("۱۲ مورد را که ویرایش یا حذف کرده بودید دست نزدیم");
  await page.reload();
  await expect(page.getByText(/۸ سؤال رایج \(خاموش\)، ۱ گفتگوی خودکار/)).toBeVisible();
  await expect(page.getByText(/چیز تازه‌ای اضافه نشد/)).toBeVisible();
  await noHorizontalScroll(page);
});

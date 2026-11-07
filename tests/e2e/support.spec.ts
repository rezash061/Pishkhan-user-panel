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

async function noA11yViolations(page: Page) {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${mock}/__mock/support?reset=1`);
  await request.post(`${mock}/__mock/announcements?set=seed`);
});

test.afterEach(async ({ request }) => {
  await request.post(`${mock}/__mock/announcements?set=none`);
});

test("support: open a ticket, get Pishkhan's answer, reply and close it", async ({ page, request }) => {
  await login(page);
  await page.goto(`${base}/support`);
  await expect(page.getByRole("heading", { name: "پشتیبانی" })).toBeVisible();
  await expect(page.getByTestId("ticket-row")).toHaveCount(2);
  await noA11yViolations(page);

  await page.getByRole("radio", { name: "بسته" }).click();
  await expect(page).toHaveURL(/status=closed/);
  await expect(page.getByTestId("ticket-row")).toHaveCount(1);
  await expect(page.getByTestId("ticket-row")).toContainText("فاکتور رسمی برای اشتراک");
  await page.getByRole("radio", { name: "همه" }).click();

  await page.getByRole("button", { name: "تیکت جدید" }).first().click();
  const dialog = page.getByRole("dialog", { name: "تیکت جدید" });
  await dialog.getByRole("button", { name: "ارسال" }).click();
  await expect(dialog.getByText("دسته را انتخاب کنید.")).toBeVisible();
  await dialog.getByLabel("موضوع").fill("پیام‌ها پاسخ داده نمی‌شوند");
  await dialog.getByLabel("دسته").selectOption("instagram");
  await dialog.getByLabel("شرح مشکل").fill("از دیشب دستیار به دایرکت‌ها جواب نمی‌دهد.");
  await dialog.getByRole("button", { name: "ارسال" }).click();

  await expect(page).toHaveURL(new RegExp(`${base}/support/[0-9a-f-]{36}$`));
  await expect(page.getByRole("heading", { name: "پیام‌ها پاسخ داده نمی‌شوند" })).toBeVisible();
  await expect(page.getByTestId("ticket-summary")).toContainText("در انتظار پشتیبانی");
  await expect(page.getByTestId("ticket-messages").locator("li")).toHaveCount(1);
  const ticketId = page.url().split("/").pop()!;

  await request.post(`${mock}/__mock/support/staff-reply?ticket=${ticketId}`);
  await page.reload();
  await expect(page.getByTestId("ticket-summary")).toContainText("پاسخ داده شد");
  await expect(page.getByTestId("ticket-messages")).toContainText("پشتیبانی پیشخوان");
  await noA11yViolations(page);

  await page.getByLabel("پاسخ شما").fill("ممنون، درست شد.");
  await page.getByRole("button", { name: "ارسال" }).click();
  await expect(page.getByTestId("ticket-messages").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("ticket-summary")).toContainText("در انتظار پشتیبانی");

  await page.getByRole("button", { name: "مشکل حل شد" }).click();
  await page.getByRole("dialog", { name: "تیکت بسته شود؟" }).getByRole("button", { name: "مشکل حل شد" }).click();
  await expect(page.getByTestId("ticket-summary")).toContainText("بسته");
  await expect(page.getByText("این تیکت بسته است.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "مشکل حل شد" })).toHaveCount(0);
});

test("announcements: a warning can be hidden, a critical notice stays", async ({ page, request }) => {
  await login(page);
  const warning = page.getByTestId("announcement").filter({ hasText: "به‌روزرسانی سرورها" });
  await expect(warning).toBeVisible();
  await page.getByRole("button", { name: "بستن این اطلاعیه" }).click();
  await expect(warning).toHaveCount(0);

  await request.post(`${mock}/__mock/announcements?set=critical`);
  await page.reload();
  const critical = page.getByRole("alert").filter({ hasText: "اختلال در اتصال اینستاگرام" });
  await expect(critical).toBeVisible();
  await expect(critical.getByRole("link", { name: "بیشتر بدانید" })).toHaveAttribute("href", "https://status.pishkhan.ir");
  await expect(critical.getByRole("button", { name: "بستن این اطلاعیه" })).toHaveCount(0);
  await expect(page.getByTestId("announcement").filter({ hasText: "به‌روزرسانی سرورها" })).toHaveCount(0);
});

test("inbox: «لینک پرداخت» puts the order's payment link into the reply box", async ({ page, request }) => {
  await request.post(`${mock}/__mock/payments/merchant`);
  await login(page);
  const conversationId = "0199b000-0000-7000-8000-000000001002";
  await page.goto(`${base}/orders/new?conversation=${conversationId}`);
  await page.getByRole("button", { name: "افزودن محصول" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /شلوار بگ جین/ }).click();
  await page.getByRole("button", { name: "ثبت سفارش" }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);

  await page.goto(`${base}/inbox/${conversationId}`);
  await page.getByRole("button", { name: "لینک پرداخت" }).click();
  await expect(page.locator("#composer")).toHaveValue(/لینک پرداخت سفارش [۰-۹]+ به مبلغ .+ تومان:\nhttps:\/\/pay\.pishkhan\.example\/pay\//);
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const workspaceId = "0199b000-0000-7000-8000-0000000000aa";
const base = `/w/${workspaceId}`;
const mock = "http://localhost:5080";
const token = (prefix: string) => `${prefix}4567890:AbCdEfGhIjKlMnOpQrStUvWx`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("شمارهٔ موبایل").fill("09120001234");
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("کد تأیید").fill("123456");
  await page.getByRole("button", { name: "ورود" }).click();
  await page.waitForURL(`**${base}`);
}

/** The side panel is inline on wide screens and a sheet («جزئیات») on narrow ones. */
async function openDetails(page: Page) {
  await page.locator("section header").waitFor();
  const details = page.getByRole("button", { name: "جزئیات" });
  if (await details.isVisible()) await details.click();
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${mock}/__mock/bale/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${mock}/__mock/bale/reset`);
  await request.post(`${mock}/__mock/outage?status=up&reset=1`);
});

test("connect a Bale bot with its BotFather token, see it listed, and disconnect it", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/channels`);
  await page.getByRole("button", { name: "اتصال بله" }).click();
  const dialog = page.getByRole("dialog", { name: "اتصال ربات بله" });
  await expect(dialog.getByText(/بات‌فادر/).first()).toBeVisible();
  const field = dialog.getByLabel("توکن ربات");
  await field.fill("not-a-token");
  await expect(dialog.getByText(/توکن باید شبیه/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "اتصال", exact: true })).toBeDisabled();
  await field.fill(token("111"));
  await dialog.getByRole("button", { name: "اتصال", exact: true }).click();
  await expect(dialog.getByText("بله این توکن را نپذیرفت. توکن را دوباره از بات‌فادر کپی کنید.")).toBeVisible();
  await field.fill(token("222"));
  await dialog.getByRole("button", { name: "اتصال", exact: true }).click();
  await expect(dialog.getByText("این ربات به کسب‌وکار دیگری در پیشخوان وصل است.")).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await field.fill(token("987"));
  await dialog.getByRole("button", { name: "اتصال", exact: true }).click();
  await expect(page.getByText("ربات بلهٔ @niloofar_bot وصل شد.")).toBeVisible();
  await expect(page.getByText("@niloofar_bot", { exact: true })).toBeVisible();
  await noHorizontalScroll(page);

  const card = page.locator("div.rounded-2xl").filter({ hasText: "@niloofar_bot" }).last();
  await card.getByRole("button", { name: "قطع اتصال" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "قطع اتصال" }).click();
  await expect(page.getByText("@niloofar_bot", { exact: true })).toHaveCount(0);
});

test("Bale conversations are labelled and have no 24-hour window; invite a customer to Bale from the side panel", async ({ page, request }) => {
  await login(page);
  // A Bale conversation whose customer wrote 11 days ago can still be answered.
  await page.goto(`${base}/inbox/0199b000-0000-7000-8000-000000001023`);
  await expect(page.locator("section header").getByText("بله", { exact: true })).toBeVisible();
  await expect(page.getByText(/اینستاگرام اجازهٔ ارسال نمی‌دهد|فقط پاسخ انسانی|پنجرهٔ پاسخ اینستاگرام/)).toHaveCount(0);
  await expect(page.getByPlaceholder(/پاسخ بنویسید/)).toBeEnabled();
  await expect(page.getByText("بدون محدودیت زمانی (بله)").first()).toBeAttached();

  // Without a bot the invite says so and links to the channels page.
  await page.goto(`${base}/inbox/0199b000-0000-7000-8000-000000001000`);
  await openDetails(page);
  await page.getByRole("button", { name: "دعوت به بله" }).first().click();
  await expect(page.getByText("هنوز ربات بله وصل نشده است.").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "اتصال ربات بله" }).first()).toHaveAttribute("href", `${base}/channels`);

  await request.post(`${mock}/api/v1/workspaces/${workspaceId}/channels/bale/connect`, { headers: { authorization: "Bearer t" }, data: { botToken: token("987") } });
  await page.reload();
  await openDetails(page);
  await page.getByRole("button", { name: "دعوت به بله" }).first().click();
  const url = page.getByLabel("لینک دعوت به ربات بله").first();
  await expect(url).toHaveValue(/^https:\/\/ble\.ir\/niloofar_bot\?start=/);
  await expect(page.getByText(/گفتگوی بلهٔ او به همین مشتری وصل می‌شود/).first()).toBeVisible();
  await page.getByRole("button", { name: "ارسال در گفتگو" }).first().click();
  await expect(page.getByText("دعوت در گفتگو فرستاده شد.")).toBeVisible();
  await expect(page.getByText(/ما را در بله هم دنبال کنید: https:\/\/ble\.ir\/niloofar_bot/).first()).toBeAttached();
});

test("the outage SMS can carry each customer's own Bale link", async ({ page, request }) => {
  await request.post(`${mock}/__mock/outage?status=down&reset=1`);
  await login(page);
  await page.goto(`${base}/settings/outage`);
  await expect(page.getByText(/با وصل کردن ربات بله/)).toBeVisible();
  await expect(page.getByRole("button", { name: "افزودن لینک بله" })).toHaveCount(0);

  await request.post(`${mock}/api/v1/workspaces/${workspaceId}/channels/bale/connect`, { headers: { authorization: "Bearer t" }, data: { botToken: token("987") } });
  await page.reload();
  await page.getByLabel("متن پیامک").fill("اینستاگرام قطع است؛ در بله پیام بدهید:");
  await page.getByRole("button", { name: "افزودن لینک بله" }).click();
  await expect(page.getByLabel("متن پیامک")).toHaveValue("اینستاگرام قطع است؛ در بله پیام بدهید: {link}");
  await expect(page.getByRole("button", { name: "افزودن لینک بله" })).toBeDisabled();
  await expect(page.getByLabel("پیش‌نمایش پیامک")).toContainText("https://ble.ir/niloofar_bot?start=");
  await expect(page.getByText("لینک بالا فقط نمونه است؛ هر نفر لینک خودش را می‌گیرد.")).toBeVisible();
  await page.getByRole("button", { name: "فرستادن پیامک" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^فرستادن به/ }).click();
  await expect(page.getByText("فرستادن پیامک‌ها شروع شد.")).toBeVisible();
});

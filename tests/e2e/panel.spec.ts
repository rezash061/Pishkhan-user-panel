import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const workspaceId = "0199b000-0000-7000-8000-0000000000aa";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("شمارهٔ موبایل").fill("۰۹۱۲۰۰۰۱۲۳۴");
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("کد تأیید").fill("123456");
  await page.getByRole("button", { name: "ورود" }).click();
  await page.waitForURL(`**/w/${workspaceId}`);
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

const fakeToken = (sub: string) =>
  `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.x`;

async function swapAccessToken(page: Page, sub: string) {
  // Leave the app first, so its own background calls cannot refresh the session behind the test's back.
  await page.goto("about:blank");
  const cookies = await page.context().cookies();
  const access = cookies.find((c) => /pk-at$/.test(c.name))!;
  await page.context().addCookies([{ ...access, value: fakeToken(sub) }]);
}

test("a token the backend refuses ends at the login page, not in a redirect loop", async ({ page }) => {
  await login(page);
  await swapAccessToken(page, "revoked");
  await page.goto("/workspaces?all=1");
  await expect(page).toHaveURL(/\/login\?expired=1/);
  await expect(page.getByText("نشست شما تمام شد. دوباره وارد شوید.")).toBeVisible();
  // The dead cookies are gone, so signing in again works.
  expect((await page.context().cookies()).some((c) => /pk-(at|rt)$/.test(c.name))).toBe(false);
  await login(page);
});

test("a backend failure shows the error page instead of bouncing to login", async ({ page }) => {
  await login(page);
  await swapAccessToken(page, "broken");
  await page.goto("/workspaces?all=1");
  await expect(page.getByText("مشکلی پیش آمد")).toBeVisible();
  expect(page.url()).toContain("/workspaces");
});

test("redirects to login and back to the requested page", async ({ page }) => {
  await page.goto(`/w/${workspaceId}/team`);
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("rejects a wrong code in Persian", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("شمارهٔ موبایل").fill("09120001234");
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("کد تأیید").fill("000000");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page.getByText("کد درست نیست.")).toBeVisible();
});

test("signs in, reads and answers a conversation", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "سلام پارسا" })).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto(`/w/${workspaceId}/inbox?filter=handed_off`);
  const first = page.locator("ul li a").first();
  await expect(first).toBeVisible();
  await first.click();

  const composer = page.getByLabel(/پاسخ بنویسید/);
  await expect(composer).toBeEnabled();
  await composer.fill("/pri");
  await page.getByRole("option").first().click();
  await expect(composer).toHaveValue(/هایلایت/);
  await page.getByRole("button", { name: "ارسال" }).click();
  // The optimistic bubble becomes the server's message: no "sending" clock and no failure.
  await expect(page.getByText(/هایلایت «قیمت»/).last()).toBeVisible();
  await expect(page.getByText("ارسال نشد")).toHaveCount(0);
  await noHorizontalScroll(page);
});

test("finds a customer by name and answers a handoff with the suggested reply", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/inbox`);
  await page.getByLabel("جستجوی گفتگو").fill("niloo");
  const row = page.locator("ul li a").first();
  await expect(row).toContainText("نیلوفر احمدی");
  // Her Instagram photo replaces the initial.
  await expect(row.locator("img")).toHaveJSProperty("complete", true);
  await expect(page.locator("ul li a")).toHaveCount(4);
  await page.getByLabel("جستجوی گفتگو").fill("هیچ‌کس");
  await expect(page.getByText("گفتگویی پیدا نشد.")).toBeVisible();

  // Conversation 1000 is handed off with a reason and a suggested reply, and has a photo and a story reply.
  await page.goto(`/w/${workspaceId}/inbox/0199b000-0000-7000-8000-000000001000`);
  await expect(page.locator("header").getByText("نیلوفر احمدی")).toBeVisible();
  const banner = page.getByRole("note");
  await expect(banner).toContainText("مشتری درخواست تخفیف عمده دارد");
  await banner.getByRole("button", { name: "استفاده" }).click();
  await expect(page.getByLabel(/پاسخ بنویسید/)).toHaveValue(/خرید عمده/);
  await expect(page.getByRole("link", { name: "پاسخ به استوری" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تصویر" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("lists a pending invitation and revokes it", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/team`);
  const last4 = String(Date.now()).slice(-4);
  await page.getByRole("button", { name: "دعوت همکار" }).first().click();
  await page.getByLabel("شمارهٔ موبایل همکار").fill(`0912111${last4}`);
  await page.getByRole("dialog").getByRole("button", { name: "دعوت همکار" }).click();
  const masked = `+۹۸۹۱۲***${last4.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹".charAt(Number(d)))}`;
  const section = page.getByRole("region", { name: "دعوت‌های در انتظار" });
  await expect(section.getByText(masked)).toBeVisible();
  await section.getByRole("button", { name: "لغو دعوت" }).last().click();
  await page.getByRole("dialog").getByRole("button", { name: "لغو دعوت" }).click();
  await expect(page.getByText("دعوت لغو شد.")).toBeVisible();
  await expect(page.getByText(masked)).toHaveCount(0);
});

test("dashboard shows the overnight summary and who answered", async ({ page }) => {
  await login(page);
  await expect(page.getByText(/دیشب ۲۳ پیام رسید/)).toBeVisible();
  await expect(page.getByText("پاسخ خودکار").filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("radio", { name: "۷ روز" }).click();
  await expect(page.getByText("پاسخ‌ها در هر روز").first()).toBeVisible();
  await noHorizontalScroll(page);
});

test("opens a notification and saves notification settings", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /^اعلان‌ها/ }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("link", { name: /نیلوفر احمدی منتظر پاسخ شماست/ }).click();
  await page.waitForURL(/\/inbox\/0199b000-0000-7000-8000-000000001000$/);

  await page.goto(`/w/${workspaceId}/settings/notifications`);
  await page.getByRole("switch", { name: "گفتگو به انسان سپرده شد: پیامک" }).click();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("تنظیم اعلان‌ها ذخیره شد")).toBeVisible();
});

test("turns on push for this browser and removes another one", async ({ page }, info) => {
  const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-${info.project.name}`;
  // Headless Chromium has no push service: stand in for the permission prompt and the PushManager.
  await page.addInitScript((endpoint) => {
    let permission: NotificationPermission = "default";
    let subscribed = false;
    Object.defineProperty(Notification, "permission", { get: () => permission });
    Notification.requestPermission = async () => (permission = "granted");
    const sub = {
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: "BHf3", auth: "e2e" } }),
      unsubscribe: async () => !(subscribed = false),
    };
    PushManager.prototype.getSubscription = async function () {
      return (subscribed ? sub : null) as unknown as PushSubscription;
    };
    PushManager.prototype.subscribe = async function () {
      subscribed = true;
      return sub as unknown as PushSubscription;
    };
  }, endpoint);
  await login(page);
  await page.goto(`/w/${workspaceId}/settings/notifications`);

  await expect(page.getByText("اعلان روی این دستگاه خاموش است.")).toBeVisible();
  await page.getByRole("button", { name: "روشن کردن" }).click();
  await expect(page.getByText("اعلان روی این دستگاه روشن شد")).toBeVisible();
  await expect(page.getByText("اعلان روی این دستگاه روشن است.")).toBeVisible();
  await expect(page.getByRole("switch", { name: "گفتگو به انسان سپرده شد: پوش" })).toBeEnabled();

  // Each project removes its own seeded browser, so the shared mock stays consistent.
  const other = info.project.name === "desktop" ? "Firefox روی Windows" : "Safari روی iOS";
  const remove = page.getByRole("button", { name: `حذف ${other}` });
  // A retry finds it already gone.
  if (await remove.count()) {
    await remove.click();
    await expect(page.getByText("دستگاه حذف شد")).toBeVisible();
  }
  await expect(remove).toHaveCount(0);

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("[data-sonner-toaster]").analyze();
  expect(axe.violations).toEqual([]);
  await noHorizontalScroll(page);

  await page.getByRole("button", { name: "خاموش کردن" }).click();
  await expect(page.getByText("اعلان روی این دستگاه خاموش شد")).toBeVisible();
  await expect(page.getByText("اعلان روی این دستگاه خاموش است.")).toBeVisible();
});

test("schedules the workspace for deletion and cancels it", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/settings`);
  await page.getByRole("button", { name: "حذف این کسب‌وکار" }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "حذف کن" });
  await dialog.getByLabel(/نام کسب‌وکار را بنویسید/).fill("گالری");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/نام کسب‌وکار را بنویسید/).fill("گالری نیلوفر");
  await confirm.click();
  await page.waitForURL(/\/workspaces\?all=1$/);
  await expect(page.getByText(/حذف در/)).toBeVisible();

  await page.getByRole("link", { name: /گالری نیلوفر/ }).click();
  await expect(page.getByRole("heading", { name: "«گالری نیلوفر» در صف حذف است" })).toBeVisible();
  await page.getByRole("button", { name: "لغو حذف و بازگرداندن" }).click();
  await expect(page.getByText("کسب‌وکار برگشت.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "سلام پارسا" })).toBeVisible();
});

test("support session shows the red banner, hides security screens and ends cleanly", async ({ page }, info) => {
  await page.goto(`/api/auth/impersonation?token=sup-${info.project.name}`);
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
  const banner = page.getByRole("region", { name: "نشست پشتیبانی" });
  await expect(banner.getByText("نشست پشتیبانی — کارشناس support.ali")).toBeVisible();
  await expect(page.getByRole("link", { name: /^اشتراک/ })).toHaveCount(0);
  await noHorizontalScroll(page);

  await page.goto("/account");
  await expect(banner).toBeVisible();
  await expect(page.getByText(/در نشست پشتیبانی، رمز عبور/)).toBeVisible();

  await banner.getByRole("button", { name: "پایان نشست" }).click();
  await expect(page).toHaveURL(/\/support-ended\?reason=ended$/);
  await expect(page.getByRole("heading", { name: "نشست پشتیبانی تمام شد" })).toBeVisible();
  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/login/);

  // The link works once.
  await page.goto(`/api/auth/impersonation?token=sup-${info.project.name}`);
  await expect(page.getByRole("heading", { name: "لینک پشتیبانی معتبر نیست" })).toBeVisible();
});

test("owner reads the activity log, with support access and its reason", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/settings/audit`);
  await expect(page.getByRole("heading", { name: "گزارش فعالیت" })).toBeVisible();
  await expect(page.getByText("پشتیبانی پیشخوان دسترسی پشتیبانی به این کسب‌وکار گرفت.")).toBeVisible();
  await expect(page.getByText("دلیل: تیکت ۴۲۱: اتصال اینستاگرام").first()).toBeVisible();
  await page.getByText("۱ تغییر").first().click();
  await expect(page.getByRole("insertion").filter({ hasText: "گالری نیلوفر" })).toBeVisible();
  await page.getByLabel("نمایش").selectOption("team");
  await expect(page.getByText("پارسا نقش یک هم‌تیمی را تغییر داد.")).toBeVisible();
  await expect(page.getByText(/دسترسی پشتیبانی به این کسب‌وکار گرفت/)).toHaveCount(0);
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("billing shows the plan and this month's usage; a full plan opens the upgrade sheet", async ({ page }) => {
  await login(page);
  await page.request.post("http://localhost:5080/__mock/billing/reset");
  await page.goto(`/w/${workspaceId}/billing`);
  await expect(page.getByRole("heading", { name: "اشتراک" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /رشد/, level: 2 })).toBeVisible();
  await expect(page.getByText("آزمایشی", { exact: true })).toBeVisible();
  await expect(page.getByRole("meter", { name: "گفتگوهای هوش مصنوعی" })).toHaveAttribute("aria-valuetext", "۴۱۲ از ۵۰۰");
  await expect(page.getByText("نزدیک سقف طرح")).toBeVisible();
  await expect(page.getByText("سقف طرح پر شده است")).toBeVisible();
  await expect(page.getByText("بدون سقف", { exact: true })).toBeVisible();
  await noHorizontalScroll(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  await page.goto(`/w/${workspaceId}/team`);
  await page.getByRole("button", { name: "دعوت همکار" }).first().click();
  await page.getByLabel("شمارهٔ موبایل همکار").fill("09120009999");
  await page.getByRole("dialog").getByRole("button", { name: "دعوت همکار" }).click();
  const sheet = page.getByRole("dialog", { name: "به سقف طرح رسیده‌اید" });
  await expect(sheet.getByText(/«اعضای تیم»/)).toBeVisible();
  await sheet.getByRole("link", { name: "مشاهدهٔ طرح‌ها" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/billing$`));
});

test("contacts: filter by tag, edit tags and fields on the contact page", async ({ page }, info) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/contacts`);
  await expect(page.getByRole("heading", { name: "مشتریان" })).toBeVisible();
  await page.getByLabel("برچسب", { exact: true }).selectOption("مشتری ویژه");
  await expect(page).toHaveURL(/tag=/);
  const rows = page.getByRole("main").getByRole("link", { name: /نیلوفر احمدی/ });
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole("link", { name: /سارا|sara_style/ })).toHaveCount(0);
  await noHorizontalScroll(page);
  await rows.click();

  await expect(page.getByRole("heading", { name: "نیلوفر احمدی" })).toBeVisible();
  await expect(page.getByLabel("شهر")).toHaveValue("شیراز");
  // Her orders, including the AI's draft.
  await expect(page.getByRole("link", { name: /سفارش #۱۰۰۱/ })).toBeVisible();
  const tag = `خوش‌قول ${info.project.name}`;
  await page.getByLabel("برچسب جدید").fill(tag);
  await page.getByRole("button", { name: "افزودن" }).click();
  await expect(page.getByRole("list", { name: "برچسب‌ها" }).getByText(tag)).toBeVisible();

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);

  await page.getByLabel("تعداد سفارش").fill("x");
  await page.getByRole("button", { name: "ذخیرهٔ اطلاعات" }).click();
  await expect(page.getByText("این مقدار با نوع فیلد جور نیست.")).toBeVisible();
  await page.getByLabel("تعداد سفارش").fill(info.project.name === "mobile" ? "۳" : "۴");
  await page.getByRole("button", { name: "ذخیرهٔ اطلاعات" }).click();
  await expect(page.getByText("ذخیره شد.")).toBeVisible();
});

test("contacts: tags, custom fields and a segment with a live count", async ({ page }, info) => {
  await login(page);
  const p = info.project.name;
  await page.goto(`/w/${workspaceId}/contacts/tags`);
  await page.getByRole("button", { name: "برچسب جدید" }).click();
  await page.getByLabel("نام برچسب").fill(`تست ${p}`);
  await page.getByRole("radio", { name: "سبز" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("برچسب ذخیره شد.")).toBeVisible();
  await page.getByRole("button", { name: `حذف تست ${p}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف برچسب" }).click();
  await expect(page.getByText("برچسب حذف شد.")).toBeVisible();

  await page.getByRole("link", { name: "فیلدهای سفارشی" }).click();
  await page.getByRole("button", { name: "فیلد جدید" }).click();
  await page.getByLabel("عنوان").fill(`سایز ${p}`);
  await page.getByLabel("کلید (انگلیسی)").fill(`size_${p}`);
  await page.getByLabel("نوع").selectOption("select");
  await page.getByLabel("گزینه‌ها").fill("S");
  await page.getByLabel("گزینه‌ها").press("Enter");
  await page.getByRole("dialog").getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText(`size_${p}`)).toBeVisible();
  await page.getByRole("button", { name: "فیلد جدید" }).click();
  await page.getByLabel("عنوان").fill("تکراری");
  await page.getByLabel("کلید (انگلیسی)").fill(`size_${p}`);
  await page.getByRole("dialog").getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("این کلید قبلاً استفاده شده است.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "انصراف" }).click();

  await page.getByRole("link", { name: "بخش‌ها" }).click();
  await page.getByRole("link", { name: "بخش جدید" }).click();
  await page.getByLabel("نام بخش").fill(`ویژه‌ها ${p}`);
  await page.getByLabel("مقدار شرط ۱").fill("مشتری ویژه");
  await expect(page.getByText("۱ مشتری با این شرط‌ها جور است.")).toBeVisible();
  await page.getByRole("button", { name: "افزودن شرط" }).click();
  await page.getByLabel("موضوع شرط ۲").selectOption("last_seen");
  await page.getByRole("radio", { name: "دست‌کم یک شرط" }).click();
  await expect(page.getByText(/مشتری با این شرط‌ها جور است/)).toBeVisible();
  await page.getByRole("button", { name: "حذف شرط ۲" }).click();
  await page.getByRole("button", { name: "ذخیرهٔ بخش" }).click();
  await expect(page.getByText("بخش ذخیره شد.")).toBeVisible();
  await expect(page).toHaveURL(/\/segments\/[0-9a-f-]{36}$/);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "همهٔ بخش‌ها" }).click();
  const row = page.getByRole("link", { name: `ویژه‌ها ${p}` }).locator("xpath=../..");
  await row.getByRole("link", { name: "۱ مشتری" }).click();
  await expect(page).toHaveURL(/segment=/);
  await expect(page.getByRole("main").getByRole("link", { name: /نیلوفر احمدی/ })).toHaveCount(1);
});

test("contacts: form answers, consent and an Excel export", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/contacts`);
  await page.getByLabel("رضایت", { exact: true }).selectOption("sms");
  await expect(page).toHaveURL(/consent=sms/);
  await expect(page.getByRole("main").getByRole("link", { name: /نیلوفر احمدی/ })).toHaveCount(1);

  await page.getByRole("link", { name: "فرم‌ها" }).click();
  await page.getByRole("link", { name: /فرم سفارش/ }).click();
  await expect(page.getByText("شیراز")).toBeVisible();
  await page.getByRole("link", { name: "نیلوفر احمدی" }).click();
  await expect(page.getByRole("heading", { name: "پاسخ‌های فرم" })).toBeVisible();
  await expect(page.getByText("رضایت داده").first()).toBeVisible();
  // Mobile and desktop share the mock, so toggle whatever the phone-call consent is now.
  await page.getByRole("button", { name: /^(ثبت رضایت|ثبت لغو رضایت) برای تماس تلفنی$/ }).click();
  await page.getByLabel("توضیح یا مدرک (اختیاری)").fill("تلفنی تأیید کرد");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await page.getByRole("dialog").getByRole("button", { name: /^ثبت/ }).click();
  await expect(page.getByText("رضایت ثبت شد.")).toBeVisible();
  await expect(page.getByText("تلفنی تأیید کرد").first()).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto(`/w/${workspaceId}/contacts`);
  await page.getByRole("button", { name: "خروجی اکسل" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ساخت فایل" }).click();
  await expect(page.getByText("ساخت فایل شروع شد؛ وقتی آماده شد خبرتان می‌کنیم.")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "دانلود" }).first().click({ timeout: 15_000 });
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
});

test("knowledge: add a FAQ, watch it index, test a question, switch a product off", async ({ page }, info) => {
  await login(page);
  const p = info.project.name;
  await page.goto(`/w/${workspaceId}/knowledge`);
  await expect(page.getByRole("heading", { name: "دانش کسب‌وکار" })).toBeVisible();
  // The failed source is retried once (on whichever project runs first) and comes back ready.
  await expect(page.getByText("راهنمای سایز", { exact: true })).toBeVisible();
  const retry = page.getByRole("button", { name: "آماده‌سازی دوبارهٔ «راهنمای سایز»" });
  if (await retry.count()) await retry.click();
  await expect(page.getByRole("button", { name: "آماده‌سازی دوبارهٔ «راهنمای سایز»" })).toHaveCount(0, { timeout: 10_000 });

  await page.getByRole("button", { name: "پرسش و پاسخ", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("پرسش").fill(`ساعت کاری فروشگاه ${p}؟`);
  await dialog.getByLabel("پاسخ").fill("هر روز از ۱۰ صبح تا ۱۰ شب جواب می‌دهیم.");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("ذخیره شد؛ دستیار به‌زودی از آن استفاده می‌کند.")).toBeVisible();
  const row = page.getByText(`ساعت کاری فروشگاه ${p}؟`).locator("xpath=ancestor::div[contains(@class,'items-start')][1]");
  await expect(row.getByText("در حال آماده‌سازی", { exact: true })).toBeVisible();
  await expect(row.getByText("آماده", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("سؤال آزمایشی").fill("ارسال به شهرستان چقدر طول می‌کشد؟");
  await page.getByRole("button", { name: "جستجو", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "ارسال به شهرستان چند روز طول می‌کشد؟" })).toBeVisible();

  await expect(page.getByRole("button", { name: "حذف «مانتو کتان تابستانه»" })).toHaveCount(0);
  await page.getByRole("switch", { name: "استفادهٔ دستیار از «مانتو کتان تابستانه»" }).click();
  await expect(page.getByText(/دستیار (دیگر )?از این منبع استفاده (نمی‌کند|می‌کند)\./)).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByRole("button", { name: `حذف «ساعت کاری فروشگاه ${p}؟»` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(page.getByText("منبع حذف شد.")).toBeVisible();
});

test("knowledge: add a document and web pages, and see why a page failed", async ({ page }, info) => {
  await login(page);
  const p = info.project.name;
  await page.goto(`/w/${workspaceId}/knowledge`);
  await expect(page.getByText("راهنمای سایز", { exact: true })).toBeVisible();

  // A document: upload, virus scan, then the backend reads its text.
  await page.getByRole("button", { name: "سند", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "sizes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 mock") });
  await expect(dialog.getByText("sizes.pdf")).toBeVisible();
  await dialog.getByLabel("عنوان").fill(`جدول سایز ${p}`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("اضافه شد؛ متنش چند لحظهٔ دیگر آماده می‌شود.")).toBeVisible();
  const doc = page.getByText(`جدول سایز ${p}`, { exact: true }).locator("xpath=ancestor::div[contains(@class,'items-start')][1]");
  await expect(doc.getByText("آماده", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(doc.getByText(/جدول سایزبندی مانتوها/)).toBeVisible();

  // A web page that cannot be opened fails with the reason.
  await page.getByRole("button", { name: "صفحهٔ وب", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("نشانی صفحه").fill("https://nowhere.example/faq");
  await dialog.getByLabel("عنوان").fill(`صفحهٔ گمشده ${p}`);
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  const broken = page.getByText(`صفحهٔ گمشده ${p}`, { exact: true }).locator("xpath=ancestor::div[contains(@class,'items-start')][1]");
  await expect(broken.getByText(/صفحه باز نشد/)).toBeVisible({ timeout: 10_000 });

  // Fix its address: the page is read again and takes its own title only when none was given.
  await page.getByRole("button", { name: `ویرایش «صفحهٔ گمشده ${p}»` }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("نشانی صفحه").fill("https://niloofar.example/shipping");
  await dialog.getByRole("button", { name: "ذخیره" }).click();
  await expect(broken.getByText("آماده", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(broken.getByRole("link", { name: "https://niloofar.example/shipping" })).toBeVisible();
  await noHorizontalScroll(page);

  for (const title of [`جدول سایز ${p}`, `صفحهٔ گمشده ${p}`]) {
    await page.getByRole("button", { name: `حذف «${title}»` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  }
});

test("AI agent: save the persona and rules, read the reply log, and follow an AI handoff to its trace", async ({ page }, info) => {
  await login(page);
  const p = info.project.name;
  await page.goto(`/w/${workspaceId}/agent`);
  await page.getByLabel("نام دستیار").fill(`پیشخوان ${p}`);
  await page.getByRole("radio", { name: "رسمی" }).click();
  await page.getByLabel("عبارت‌های ممنوع").fill("ارسال رایگان");
  await page.getByLabel("عبارت‌های ممنوع").press("Enter");
  await page.getByLabel("سایت‌های مجاز برای لینک").fill("https://www.shop.example.ir/sale");
  await page.getByLabel("سایت‌های مجاز برای لینک").press("Enter");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await page.getByRole("button", { name: "ذخیرهٔ تنظیمات دستیار" }).click();
  await expect(page.getByText("تنظیمات دستیار ذخیره شد.")).toBeVisible();
  // The backend keeps only the host of a link.
  await expect(page.getByText("shop.example.ir", { exact: true })).toBeVisible();
  await expect(page.getByLabel("نام دستیار")).toHaveValue(`پیشخوان ${p}`);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "گزارش پاسخ‌ها" }).click();
  await page.getByRole("radio", { name: "به تیم سپرد" }).click();
  await expect(page).toHaveURL(/outcome=handed_off/);
  await expect(page.getByText("ارسال به شیراز چند روز طول می‌کشه؟")).toHaveCount(0);
  await page.getByRole("link", { name: /مانتو کتان چنده؟/ }).click();
  await expect(page.getByText("جواب دستیار قیمتی داشت که در اطلاعات فروشگاه نبود.")).toBeVisible();
  await expect(page.getByText("get_product")).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto(`/w/${workspaceId}/inbox/0199b000-0000-7000-8000-000000001008`);
  const banner = page.getByRole("note");
  await expect(banner).toContainText("دستیار از جوابش مطمئن نبود.");
  await expect(banner).toContainText("پیش‌نویس دستیار (مطمئن نبود)");
  await banner.getByRole("link", { name: "چرا؟" }).click();
  await expect(page).toHaveURL(/agent\/log\?conversation=/);
  await expect(page.getByRole("link", { name: /قدم ۱۶۵ه/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /مانتو کتان چنده؟/ })).toHaveCount(0);
});

test("AI agent test chat: an answer with its reasons, a VIP handoff, and a correction prefilled as a FAQ", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/agent/test`);
  const chat = page.getByRole("log");
  await page.getByLabel("پیام مشتری").fill("ارسال به شهرستان چند روز طول می‌کشد؟");
  await page.getByLabel("پیام مشتری").press("Enter");
  await expect(chat.getByText(/پست پیشتاز/)).toBeVisible();
  await chat.getByRole("button", { name: "چرا این جواب؟" }).click();
  await expect(chat.getByRole("heading", { name: "اطلاعات استفاده‌شده" })).toBeVisible();
  await chat.getByRole("button", { name: "جواب درست را یاد بدهید" }).click();
  await expect(page.getByRole("dialog").getByLabel("پرسش")).toHaveValue("ارسال به شهرستان چند روز طول می‌کشد؟");
  await page.getByRole("dialog").getByRole("button", { name: "انصراف" }).click();

  await page.getByLabel("برچسب‌های مشتری آزمایشی").fill("vip");
  await page.getByLabel("برچسب‌های مشتری آزمایشی").press("Enter");
  await page.getByLabel("پیام مشتری").fill("سلام، وقت بخیر");
  await page.getByRole("button", { name: "بفرست" }).click();
  await expect(chat.getByText("مشتری برچسب ویژه دارد.")).toBeVisible();
  await expect(chat.getByText("به تیم سپرده شد")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "شروع دوباره" }).click();
  await expect(chat.getByText("مشتری برچسب ویژه دارد.")).toHaveCount(0);
});

test("unanswered questions: answer one into a FAQ and dismiss another", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/knowledge/unanswered`);
  await expect(page.getByRole("radio", { name: "منتظر جواب" })).toBeChecked();
  // Mobile and desktop share the mock: whichever runs first answers and dismisses, the other checks the result.
  const answer = page.getByRole("button", { name: "جواب به «برای کیش هم ارسال دارید؟»" });
  await expect(page.getByRole("main").getByText(/بار پرسیده شد|سؤال بی‌جوابی نمانده است/).first()).toBeVisible();
  if (await answer.count()) {
    await answer.click();
    await page.getByRole("dialog").getByLabel("جواب").fill("بله، ارسال به کیش با پست پیشتاز سه تا پنج روز کاری است.");
    await page.getByRole("dialog").getByRole("button", { name: "افزودن به پرسش و پاسخ‌ها" }).click();
    await expect(page.getByText("به پرسش و پاسخ‌ها اضافه شد؛ دستیار به‌زودی از آن استفاده می‌کند.")).toBeVisible();
  }
  const dismiss = page.getByRole("button", { name: "نادیده گرفتن «جنس آستر مانتو چیه؟»" });
  if (await dismiss.count()) {
    await dismiss.click();
    await expect(page.getByText("نادیده گرفته شد. اگر دوباره پرسیده شود برمی‌گردد.")).toBeVisible();
  }
  await expect(page.getByText("برای کیش هم ارسال دارید؟")).toHaveCount(0);
  await page.getByRole("radio", { name: "جواب داده شد" }).click();
  await expect(page.getByText("برای کیش هم ارسال دارید؟")).toBeVisible();
  await page.getByRole("radio", { name: "نادیده گرفته شد" }).click();
  await expect(page.getByText("جنس آستر مانتو چیه؟")).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "منابع" }).click();
  await page.getByLabel("جستجو در منابع").fill("کیش");
  await expect(page.getByText("برای کیش هم ارسال دارید؟")).toBeVisible();
});

test("orders: the AI draft is listed, a new order is created from a chat, paid, noted and printed", async ({ page }, info) => {
  await login(page);
  const p = info.project.name;
  await page.goto(`/w/${workspaceId}/orders`);
  await expect(page.getByRole("heading", { name: "سفارش‌ها", level: 1 })).toBeVisible();
  const aiDraft = page.getByRole("link", { name: /سفارش #۱۰۰۱/ });
  await expect(aiDraft).toContainText("ثبت دستیار");
  await page.getByRole("tab", { name: "آمادهٔ ارسال" }).click();
  await expect(page.getByRole("link", { name: /سفارش #۱۰۰۲/ })).toBeVisible();
  await expect(aiDraft).toHaveCount(0);
  await page.getByRole("tab", { name: "همه" }).click();
  await page.getByLabel("جستجوی سفارش").fill("۱۰۰۲");
  await expect(page.getByRole("main").getByRole("link", { name: /سفارش #/ })).toHaveCount(1);

  // A new order for conversation 1003 (one per project, so the runs do not collide).
  const conversation = `0199b000-0000-7000-8000-00000000${p === "mobile" ? "1003" : "1004"}`;
  await page.goto(`/w/${workspaceId}/orders/new?conversation=${conversation}`);
  await page.getByRole("button", { name: "افزودن محصول" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /شلوار بگ جین/ }).click();
  await page.getByLabel("تعداد").first().fill("2");
  await page.getByRole("button", { name: "قلم دستی" }).click();
  await page.getByLabel("شرح").fill("کیسهٔ هدیه");
  await page.getByLabel("قیمت واحد").fill("50000");
  await page.getByLabel("هزینهٔ ارسال").fill("60000");
  await page.getByLabel("نام مشتری").fill(`مشتری ${p}`);
  await page.getByLabel("نشانی کامل (چسباندن)").fill("شیراز، خیابان زند، کوچه ۵، پلاک ۸، کد پستی 7134567890، 09121234567");
  await page.getByRole("button", { name: "جدا کردن خودکار" }).click();
  await expect(page.getByLabel("استان")).toHaveValue("FRS");
  await expect(page.getByLabel("شهر", { exact: true })).toHaveValue("شیراز");
  await expect(page.getByLabel("کد پستی")).toHaveValue("7134567890");
  await expect(page.getByLabel("موبایل")).not.toHaveValue("");
  await expect(page.getByText("مبلغ تقریبی")).toBeVisible();
  const editorAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("[data-sonner-toaster]").analyze();
  expect(editorAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "ثبت سفارش" }).click();
  await expect(page.getByText(/سفارش #[۰-۹]+ ثبت شد\./)).toBeVisible();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByText("کیسهٔ هدیه")).toBeVisible();
  // 2 × 1,250,000 + 50,000 + 60,000 shipping
  await expect(page.getByText("۲٬۶۱۰٬۰۰۰ تومان")).toBeVisible();

  // Ask for payment, then mark it paid with a note.
  await page.getByRole("button", { name: "در انتظار پرداخت", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "در انتظار پرداخت" }).click();
  await expect(page.getByText("وضعیت سفارش «در انتظار پرداخت» شد.")).toBeVisible();
  await expect(page.getByRole("link", { name: "ویرایش" })).toHaveCount(0);
  await page.getByRole("button", { name: "پرداخت‌شده", exact: true }).click();
  await page.getByRole("dialog").getByLabel("یادداشت (اختیاری)").fill("کارت به کارت، پیگیری ۱۲۳۴");
  await page.getByRole("dialog").getByRole("button", { name: "پرداخت‌شده" }).click();
  await expect(page.getByText("وضعیت سفارش «پرداخت‌شده» شد.")).toBeVisible();
  await expect(page.getByText("کارت به کارت، پیگیری ۱۲۳۴")).toBeVisible();
  await page.getByLabel("افزودن یادداشت").fill("فردا ارسال شود");
  await page.getByRole("button", { name: "افزودن یادداشت" }).click();
  await expect(page.getByText("فردا ارسال شود")).toBeVisible();
  const detailAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("[data-sonner-toaster]").analyze();
  expect(detailAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "فاکتور" }).click();
  await expect(page.getByRole("heading", { name: "فاکتور فروش" })).toBeVisible();
  await expect(page.getByText("۲٬۶۱۰٬۰۰۰ تومان")).toBeVisible();
  await expect(page.getByRole("button", { name: "چاپ" })).toBeEnabled();

  // The conversation's side panel lists it.
  if (p === "desktop") {
    await page.goto(`/w/${workspaceId}/inbox/${conversation}`);
    await expect(page.getByRole("complementary").getByRole("link", { name: /سفارش #[۰-۹]+/ })).toBeVisible();
  }
});

test("orders: editing the AI draft reports a missing size on its line", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "one run is enough; it edits shared mock state");
  await login(page);
  await page.goto(`/w/${workspaceId}/orders/0199b000-0000-7000-a000-000000000001`);
  await expect(page.getByRole("heading", { name: /سفارش #۱۰۰۱/ })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("کد پستی");
  await page.getByRole("link", { name: "ویرایش" }).click();
  await page.getByLabel("مدل «مانتو کتان تابستانه»").selectOption("");
  await page.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
  await expect(page.getByText("مدل (رنگ یا سایز) را انتخاب کنید.")).toBeVisible();
  await page.getByLabel("مدل «مانتو کتان تابستانه»").selectOption({ label: "XL" });
  await page.getByLabel("کد پستی").fill("7134567890");
  await page.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
  await expect(page.getByText("سفارش ذخیره شد.")).toBeVisible();
  await expect(page.getByText("۹۵۰٬۰۰۰ تومان").first()).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
});

test("payments: connect Zarinpal, send a payment link, and the order turns paid when the customer pays", async ({ page }, info) => {
  await login(page);
  const p = info.project.name;
  await page.goto(`/w/${workspaceId}/orders/new`);
  await page.getByRole("button", { name: "افزودن محصول" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /شلوار بگ جین/ }).click();
  await page.getByLabel("نام مشتری").fill(`پرداخت ${p}`);
  await page.getByRole("button", { name: "ثبت سفارش" }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderUrl = page.url();
  const orderId = orderUrl.split("/").at(-1)!;

  const card = page.getByRole("main");
  await card.getByRole("button", { name: "ساخت لینک پرداخت" }).click();
  const outcome = page.getByText(/لینک پرداخت ساخته شد|هنوز درگاه زرین‌پال وصل نشده است/).first();
  await expect(outcome).toBeVisible();
  if ((await outcome.textContent())?.includes("وصل نشده")) {
    // First run: no merchant yet. The card links to the payment settings.
    await page.getByRole("link", { name: "اتصال درگاه" }).click();
    await page.waitForURL(/\/settings\/payments$/);
    await expect(page.getByText("وصل نشده")).toBeVisible();
    await page.getByLabel("کد مرچنت زرین‌پال").fill("1234");
    await page.getByRole("button", { name: "اتصال درگاه" }).click();
    await expect(page.getByText(/کد مرچنت باید ۳۶ نویسه باشد/)).toBeVisible();
    await page.getByLabel("کد مرچنت زرین‌پال").fill("aaaaaaaa-bbbb-cccc-dddd-eeeeeeee1234");
    await page.getByRole("button", { name: "اتصال درگاه" }).click();
    await expect(page.getByText("درگاه زرین‌پال وصل شد.")).toBeVisible();
    await expect(page.getByText("••••1234")).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("[data-sonner-toaster]").analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    await page.goto(orderUrl);
    await card.getByRole("button", { name: "ساخت لینک پرداخت" }).click();
    await expect(page.getByText("لینک پرداخت ساخته شد. آن را برای مشتری بفرستید.")).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 1 }).getByText("در انتظار پرداخت")).toBeVisible();
  await expect(page.getByLabel("نشانی لینک پرداخت")).toHaveValue(/^https:\/\/pay\.pishkhan\.example\/pay\//);
  await expect(page.getByRole("button", { name: "کپی لینک" })).toBeVisible();
  await noHorizontalScroll(page);

  // The customer pays at Zarinpal; the backend marks the order paid.
  const paid = await page.request.post(`http://localhost:5080/__mock/orders/${orderId}/pay`);
  expect(paid.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 }).getByText("پرداخت‌شده")).toBeVisible();
  await expect(page.getByText(/کد پیگیری ۵۰۱۲۳۴۵۶/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "ساخت لینک پرداخت" })).toHaveCount(0);
});

test("adds an internal note", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/inbox/0199b000-0000-7000-8000-000000001001`);
  // Desktop (xl) shows the side panel next to the thread; phones open it as a sheet.
  const desktop = (page.viewportSize()?.width ?? 0) >= 1280;
  if (!desktop) await page.getByRole("button", { name: "جزئیات" }).click();
  const panel = desktop ? page.locator("aside").last() : page.getByRole("dialog");
  // The mock keeps state between tests, so each run writes its own note.
  const text = `مشتری عجله دارد ${Date.now()}`;
  await panel.getByLabel("افزودن یادداشت").fill(text);
  await panel.getByRole("button", { name: "افزودن یادداشت" }).click();
  await expect(panel.getByText(text)).toBeVisible();
});

test("saves business hours and shows a saved toast", async ({ page }) => {
  await login(page);
  await page.goto(`/w/${workspaceId}/settings/business-hours`);
  await page.getByRole("button", { name: /افزودن تعطیلات نوروز/ }).click();
  await expect(page.getByText(/فروردین/).first()).toBeVisible();
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByText("ذخیره شد")).toBeVisible();
});

test("key pages have no serious accessibility violations", async ({ page }) => {
  await login(page);
  for (const path of ["", "/inbox", "/orders", "/channels", "/team", "/settings"]) {
    await page.goto(`/w/${workspaceId}${path}`);
    await page.waitForLoadState("networkidle");
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
    const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  }
});

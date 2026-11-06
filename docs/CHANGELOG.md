# Changelog

## 0.28.0 — 2026-11-06

- Coupons and the wallet at checkout (backend #55, BE-1.11; UP-2.8):
  - Quote dialog: «کد تخفیف دارید؟» opens a code field. The code is tried on the quote first; a refused one (invalid, expired, used up, not for this plan, first purchase only, already used) is explained in Persian under the field and the quote stays as it was. An applied code shows as a chip with «حذف کد», and the discount gets its own row.
  - Quote dialog: with a wallet balance, «پرداخت از کیف پول (موجودی …)» takes as much as it can; the wallet part gets its own row. When the coupon and the wallet cover it all, the button reads «پرداخت و فعال‌سازی», no gateway is opened, and the panel goes straight to the paid checkout. A note explains when part of the balance is kept back for Zarinpal's 1,000 Toman minimum.
  - Each coupon and wallet choice uses its own Idempotency-Key, so a double tap opens one payment and a changed choice opens a new one.
  - «کیف پول» card on the billing page: balance, «افزایش موجودی» (presets or any amount from 10,000 to 100,000,000 Toman, checked before sending, paid through Zarinpal), and the latest changes (top-up, staff adjustment, refund, spent on a plan, given back) with the balance after each. Rows tied to a checkout open it.
  - Checkout page and history: the discount with its code, the wallet part, and «پرداخت در درگاه»; wallet top-ups show as «شارژ کیف پول» without plan or cycle.
  - A checkout with no `paymentUrl` (overage included) opens the checkout page instead of the gateway.
- Mock Api host: coupons (NOROOZ, FIRST50, PRO20, FREEALL, OLD), the wallet with top-ups, holds and give-backs, and checkouts paid without the gateway. `/__mock/billing/wallet?balance=` sets the balance in Rial.
- API refreshed from backend main (BE-1.11).
## 0.27.0 — 2026-11-05

- Card-to-card receipts (backend #50, BE-2.10; UP-2.2 and UP-2.3):
  - Settings «پرداخت»:
    - «کارت‌ها و شباهای دریافت» (`workspace.settings.write`): add, edit, pause and remove up to 10 accounts. The card is checked with Luhn and the Sheba with mod 97 before sending; Persian digits, spaces and dashes are accepted. Each account shows its bank, the card in groups of four and the Sheba.
    - «بررسی رسیدها»: confidence threshold (80–100%), amount tolerance in Toman, and the payment window in hours.
    - The auto-approve switch is disabled while `autoApproveAvailable` is false, with a note saying why. When it is allowed, turning it on first asks for a confirmation that explains the risk of fake receipts.
  - «رسیدهای کارت به کارت» at `/orders/receipts` (linked from «سفارش‌ها»):
    - Tabs: needs review (the default), auto-approved, approved, rejected, all. Each row shows the amount, status and failed checks.
    - The detail sheet shows the receipt image (a signed 10-minute URL) and the fields read off it (amount, Jalali time, reference, cards, bank, confidence).
    - Every check is shown as an icon plus a word (pass/fail/unknown) with the reason in Persian, never colour alone. Links go to the order, the conversation and the earlier receipt of a duplicate.
    - «تأیید رسید» pays the order. When the receipt has no order, the seller picks one of the customer's orders awaiting payment. «رد رسید» needs a reason (300 characters at most).
    - A duplicate rejected automatically is labelled «تکراری (رد خودکار)» and can still be approved.
    - The list and the sheet poll while a receipt is still being scanned or read.
  - Order page: «رسیدهای کارت به کارت» lists the order's receipts. While the order awaits payment, «ثبت رسید» uploads an image or PDF (purpose `receipt`), waits for the virus scan, submits it and opens it in the queue.
  - Inbox: «ثبت به‌عنوان رسید» under a customer's image (`workspace.orders.write`) submits it for the customer's order awaiting payment.
  - Notifications of kind `receipt` get their own icon. All the new `payments.*` error codes are in Persian.
- Mock Api host: bank accounts, receipt settings and receipts with their checks. `/__mock/receipts?scenario=seed|reset` adds an order awaiting payment and three receipts (one with a wrong amount, an automatic duplicate, an approved one).
- API refreshed from backend main (BE-2.8 overage and BE-2.10 receipts).
## 0.26.0 — 2026-11-04

- Overage billing (backend #49, BE-2.8 overage):
  - «مصرف مازاد» card on the billing page (`GET /billing/overage`):
    - the AI conversations used against the plan's share;
    - the extra conversations, the price of each and the cost so far, against this period's cap;
    - the state in Persian (within, overage, plan limit, cap reached, unpaid) with what it means for new conversations.
    - On a trial or the free plan (`available: false`) the editor is hidden. The card explains that the AI hands new conversations to the team at the limit, and links to the plans.
  - Settings (`workspace.billing.manage`, PUT): overage on or off, and the cap per period, either the default (the plan's monthly price) or a Toman amount from 0 to 10× it, checked before saving. `billing.overage.cap_invalid` is in Persian. The explanation: when overage is off or at the cap, new conversations go to the team.
  - «صورت‌حساب‌های مازاد»: period, conversations, price each, amount, and due or settled (with when).
  - «پرداخت» when something is due: `POST /overage/checkout` with an Idempotency-Key goes to Zarinpal and returns through the existing `?checkout=` handling. An overage checkout reads «پرداخت مصرف مازاد», has no plan cycle, and its result says the debt is paid. `billing.overage.checkout_pending`, `billing.overage.nothing_due`, `billing.checkout.unavailable` and `billing.checkout.gateway_unavailable` are in Persian.
  - When an unpaid charge has stopped the AI (`blocked`), a prominent notice with the amount shows on the billing page (with the pay button) and on the dashboard (linking to billing).
  - Handoff reasons `ai:overage_cap` and `ai:overage_unpaid` read in Persian, beside `ai:plan_limit`. Notifications of kind `billing` get a card icon and a name in the preferences.
- Fix: success badges use a darker green for their text (3.2:1 → AA contrast); axe flagged «در محدودهٔ طرح» on phones.
- Fix: a switch inside a `<label>` toggled twice on one click, so the follow-up toggles in the rule editor could not be turned off. The rows are no longer labels (the switch carries its own name), and the follow-ups e2e test checks a toggle turns off.
- Mock Api host: overage scenarios (`/__mock/overage?scenario=trial|overage|unpaid`), settings, charges, and overage checkouts through the stand-in gateway. New e2e spec `overage.spec.ts`.
- API refreshed from backend main (BE-2.8 overage).

## 0.25.0 — 2026-11-04

- Bale (backend #48, BE-2.7 part 2):
  - Channels «اتصال بله» (`workspace.channels.manage`): connect the shop's own Bale bot with its token. The dialog explains each step: make a bot with BotFather (بات‌فادر) in Bale, copy the token, paste it. The token's shape is checked before sending.
    - Errors in Persian: `channels.bale_token_invalid`, `channels.bale_bot_taken`, `channels.bale_unavailable`, and `billing.plan_limit` (which also opens the upgrade sheet).
    - Bale bots are listed with their username, a Bale icon and status. They are disconnected the usual way, with their own warning. «پست‌های اخیر» and the Instagram reconnect are hidden for them.
  - Inbox: Bale conversations carry a «بله» label in the list and the thread header and show the Bale icon in the side panel. Bale has no 24-hour window, so the window warning is hidden and the side panel reads «بدون محدودیت زمانی (بله)».
  - «دعوت به بله» on the contact page and in the inbox side panel (`workspace.crm.write`) makes a one-time link valid 14 days, with «کپی لینک» and «کپی متن دعوت». While the Instagram window is open, «ارسال در گفتگو» sends the invitation through the normal send. It explains that pressing start in Bale joins that chat to the same contact. `channels.bale_not_connected` links to the channels page.
  - Outage campaign: «افزودن لینک بله» puts `{link}` at the cursor, and the help says each recipient gets their own link. The preview shows a sample link in its place. Without a bot, a line links to connecting one. `outage.link_needs_bale` is in Persian.
- Mock Api host: Bale connect with token outcomes, disconnect, a Bale conversation (23), invite links, `{link}` checks and `/__mock/bale/reset`. New e2e spec `bale.spec.ts`.
- API refreshed from backend main (BE-2.7 part 2).

## 0.24.0 — 2026-11-04

- Instagram outage (backend #47, BE-2.7 part 1):
  - While `GET /channels/outage` says `down`, a red banner across the panel reads «اینستاگرام در دسترس نیست» and links to the campaign page. The status is checked every minute and refreshed at once when a `channel_outage` notification arrives.
  - Settings «قطعی اینستاگرام» (`/settings/outage`, the backend notification's link; `workspace.crm.read`, sending needs `workspace.crm.write`):
    - Instagram's status and since when.
    - The audience: contacts, with a mobile, and agreed to SMS.
    - The text (5–300 characters) with a live SMS preview that puts the shop's name in front, as the backend does, and the number of SMS parts. A hint appears when the text has no Bale or website link.
    - «فرستادن پیامک» asks to confirm and names how many people will get it, then sends with an Idempotency-Key.
    - `outage.not_down` and `outage.campaign_cooldown` are in Persian; the next allowed time (`nextAllowedAt`) shows in Jalali.
    - History with progress (polled while `sending`) and `limit_reached` explained.
  - Flows: the «کار» step offers «ذخیره شماره با رضایت» (`capture_phone`). Its `value` defaults to `{{flow.phone}}` and it takes `consentText`, the question the customer agreed to (5–500 characters). The help explains that the consent is recorded with that question and that rules cannot use it. `flow.capture_phone_invalid` and `automation.capture_phone_flow_only` are in Persian, and the rule editor never offers it.
- The red banner's text is darker in light mode, for contrast (WCAG AA).
- Mock Api host: outage status (up unless a test turns it down with `/__mock/outage`), audience, campaigns texting 2 people a second, the 24-hour cooldown, and `capture_phone` validation. New e2e spec `outage.spec.ts`.
- API refreshed from backend main (BE-2.7 part 1).

## 0.23.0 — 2026-11-03

- Feed import (backend #46, BE-2.5, UP-2.5 "feed import review"):
  - «ورود از پست‌ها» tab under knowledge, and onboarding step 4 between the template and the teach steps (now five steps):
    - Pick a connected Instagram account and how many recent posts to read (50 by default, kept within 1–200). It says that nothing goes live until the owner accepts it.
    - `knowledge.feed_import_running` links to the running import, and `knowledge.channel_not_found` is in Persian.
  - Progress: polled every 3 seconds while `running`, with posts read, analyzed and failed, the suggestions found, and a bar. A failed import shows its `error`.
  - Review: suggestions grouped by post, with the post's image (Instagram's CDN, or a placeholder) and a link to the post.
    - Product cards edit the title, description, price in Toman and tags inline (PUT). FAQ cards edit the question and answer.
    - A price that was not in the caption shows «این قیمت در متن پست نبود؛ بررسی کنید». Accepted as is, the product becomes a catalog draft; once the owner edits the price it is theirs, and the product goes on sale. Each product card says which it will be.
    - «پذیرفتن» (saves edits first), «رد کردن», and «پذیرفتن همه انتخاب‌شده‌ها» (up to 100) with each failed item's reasons on its own card. `knowledge.feed_item_invalid` shows the catalog's own error keys, and `knowledge.feed_item_not_pending` is in Persian.
    - Accepting needs both `workspace.knowledge.write` and `workspace.catalog.write`. An accepted card links to its product or FAQ.
  - «ورودهای قبلی»: the last 20 imports with status, posts, suggestions and how many still wait.
- Mock Api host: a Persian three-post import (`tests/mock-api/fixtures/feed-import.json`) with products and FAQs, one price not in the caption and one product without a name. A run completes after about 4 seconds, and `/__mock/feed/reset` starts over. New e2e spec `feed-import.spec.ts`.
- API refreshed from backend main (BE-2.5).

## 0.22.0 — 2026-11-03

- Voice notes (backend #45, BE-2.4):
  - Under a customer's voice note in the thread (player, or its placeholder once Instagram's link expires) the transcript shows its state:
    - «در حال تبدیل صدا به متن…» with a small spinner, as a status for screen readers;
    - the text the AI and the rules answered, labelled «متن پیام صوتی»;
    - «تبدیل انجام نشد — گفتگو به همکار شما سپرده شد».
  - The handoff reason `voice_unavailable` reads «پیام صوتی قابل تبدیل نبود» everywhere handoff reasons are shown.
- Realtime: the hub pushes a voice note again when its transcript arrives. A pushed message whose id is already loaded, on any page, is replaced in place; fields the push leaves out keep their value. A new message goes where its time belongs. One older than everything loaded is left for the page that holds it, instead of jumping to the top. The logic is the pure `mergeMessage`, with unit tests.
- Mock Api host: conversation 16 has a transcribed, a pending and a failed voice note, and a `voice_unavailable` handoff. New e2e spec `voice-notes.spec.ts`.
- API refreshed from backend main (BE-2.4: `transcript` and `transcriptStatus` on messages).

## 0.21.1 — 2026-11-03

- Fix main after the merges of #21 and #22. CI had failed on main since #21.
  - `openapi/api.v1.json` and `messages/fa.json` were not valid JSON.
  - The mock Api host had lost two lines in a merge, so e2e could not start.
  - The Instagram step had duplicated links.
  - The OpenAPI copy is restored from backend main at BE-1.9, and the generated client is unchanged.
- Onboarding now runs workspace → Instagram → industry template → teach the assistant, in four steps. The template step's buttons read «ادامه: آموزش دستیار» and «فعلاً نه، ادامه» and lead to the teach step.
- The changelog's lost 0.19.0 entry (follow-gate) is back, and the README has one onboarding row.

## 0.21.0 — 2026-11-03

- Finglish (backend #44, BE-2.3):
  - Inbox: a customer message mostly in Latin letters (at least 70% of its letters, ignoring links and @handles) gets a small «فینگلیش» hint. Its tooltip, also read by screen readers, says the AI and the rules read such messages in Persian script.
  - AI reply log: a trace's language `finglish` reads «فینگلیش», with a line saying the assistant read it in Persian script. Other languages read «فارسی», «انگلیسی» and «عربی».
  - Rule editor: under the keyword match, a line says Persian keywords also match Finglish, for example «gheymat» with «قیمت».
- `src/lib/persian/finglish.ts` mirrors the backend's 70% character test. The backend also checks its word lists before it treats a message as Finglish.
- Mock Api host: one Finglish customer message and one Finglish trace. New e2e spec `finglish.spec.ts`.
- The API document is unchanged by BE-2.3.
## 0.20.0 — 2026-11-03

- Knowledge score and onboarding interview (backend #43, BE-1.9):
  - «امتیاز دانش» tab under knowledge (`workspace.settings.read`):
    - a half-ring gauge (0–100, named in text: needs work, getting there, ready);
    - each part as points out of its maximum: the industry's required facts, products, unanswered questions;
    - the facts checklist: a covered fact's «مشاهدهٔ جواب» opens its source, a missing one has «پاسخ بده»;
    - product counts (active, priced, in stock);
    - the backend's `knowledge.suggest.*` in Persian, each linking to its page (interview, knowledge, new product, catalog, unanswered questions).
  - «آموزش دستیار» interview (`workspace.knowledge.write`), at `/knowledge/interview` and as onboarding step 3 after Instagram (connected or skipped):
    - The assistant asks each missing fact's `prompt` in a chat. The owner answers in their own words (up to 1,000 characters).
    - `POST /onboarding/draft` returns a FAQ, shown as editable question and answer fields with «هوش مصنوعی پیش‌نویس کرد» or «از متن خودتان» (no model).
    - «تأیید و ذخیره» calls `/onboarding/confirm`, and the gauge rises with «امتیاز از … به … رسید».
    - «رد شدن» moves on. «پاسخ بده» on the score page starts at that fact.
  - Knowledge sources that answer a required fact (`factKey`) show «جواب «…»» with the fact's label. `?source=` opens a source's editor.
- `knowledge.fact_unknown` in Persian.
- Mock Api host: score, draft and confirm (with a no-model fallback) built from the backend seeds' required facts (`tests/mock-api/fixtures/required-facts.json`), `factKey` on sources, `GET /knowledge/sources/{id}`, and `/__mock/knowledge/reset-facts`. New e2e spec `knowledge-score.spec.ts`.
- API refreshed from backend main (BE-1.9).
## 0.19.0 — 2026-11-03

- Follow-gate and follow-ups (backend #42, BE-1.8):
  - Flows: the «شرط فالو» step is no longer marked «به‌زودی». It takes the message sent with the «دنبال کردم ✅» quick reply, the text sent while the customer still doesn't follow, and how many re-checks (0–5, default 2). Its two exits are labelled «دنبال‌کرده» and «دنبال نکرده», and a new gate's «دنبال‌کرده» exit continues where the old exit went. The help text says that every answer is re-checked, that an unknown follow status lets the customer through, and what happens when «دنبال نکرده» is left empty.
  - «پیگیری» (`schedule_followup`) in DM rules and in flow «کار» steps takes a message, a delay in minutes or hours (1 minute to 23 hours, clamped), and «اگر مشتری پیام داد / خرید کرد، فرستاده نشود», both on by default. The help text explains Instagram's 24-hour window. A rule takes at most one; comment rules don't offer it.
  - «پیگیری‌ها» tab under automations: pending (soonest first), sent, cancelled and not sent, kept in the URL. Each row has the Jalali due time, the message, rule or flow, a link to the conversation, the reason in Persian (replied, purchased, owner, replaced, handed_off, window_closed, conversation_gone), and «لغو پیگیری» for pending ones (`workspace.automation.write`).
  - The inbox side panel lists the conversation's pending follow-ups, with cancel.
- Persian messages for `automation.followup_delay_invalid`, `automation.one_followup`, `flow.followup_invalid` and `automation.followup_not_pending`. The editor checks the delay and the one-follow-up rule before saving.
- Mock Api host: follow-ups with Persian sample data, list, cancel and `/__mock/followups/reset`, and gate and follow-up validation. New e2e spec `followups.spec.ts`.
- API refreshed from backend main at the BE-1.8 merge.

## 0.18.0 — 2026-11-03

- Industry templates (backend #40, BE-2.9, UP-2.5):
  - Onboarding step 3 «قالب صنف», after connecting Instagram (or skipping it). It lists the published templates with the workspace's own industry first, marked «پیشنهادی» and picked. A preview shows what applying adds: the facts the assistant needs, FAQs with their answers, flow names, rules with their trigger, and the agent profile (name, tone, brand voice, never-say phrases, handoff words). The step can be skipped.
  - «اعمال قالب» sends an Idempotency-Key. The result lists the FAQs added (off), flows (published), rules (off), whether the agent profile was set, and what was left alone because the owner had edited or deleted it. It says to fill blanks such as [مبلغ] and switch the items on, and links to the knowledge and automation pages.
  - Settings «قالب صنف»: the same picker for applying later or again, with each template's last apply, and «سابقهٔ اعمال قالب» from `GET /templates/applications`. Owners and admins apply (`workspace.settings.write`); others see the preview and the history (`workspace.settings.read`).
- Mock Api host: the five built-in templates, from the backend's `Seeds/*.json` (`tests/mock-api/fixtures/industry-templates.json`). Applying adds by key like the backend, and `/__mock/templates/reset` starts over. New e2e spec `templates.spec.ts`.
- API refreshed from backend main (BE-2.9).

## 0.17.0 — 2026-11-03

- Subscription checkout (backend #39, BE-2.8, Zarinpal): «اشتراک» now sells the plans itself.
  - «طرح‌ها» lists the plans on sale in display order with their price in Toman, limits and features. The current plan is marked, and each plan says what buying it would be now: buy (new), renew, upgrade or downgrade, with when it starts. A plan that can't be bought says why, in Persian. A monthly or annual toggle shows the annual saving. A plan with only one price stays on it and says so.
  - Picking a plan opens the quote (`POST /checkout/quote`): the plan's price, the credit an upgrade gets for the unused part of the current period, the amount, and the Jalali start and end. «پرداخت» opens the checkout with one Idempotency-Key per quote and sends the browser to Zarinpal.
  - Return: the backend redirects to `/billing?checkout={id}&status=…`. That route sends the payer to `/w/{ws}/billing/checkouts/{id}` in the workspace that started the payment (the `pk-checkout` cookie, or the last workspace). The page always reads `GET /checkouts/{id}` and shows one of: paid (invoice number, tracking code, card, and when the period starts), failed with the gateway code, cancelled, expired, or pending. A pending checkout is checked every 5 seconds for two minutes and has «بررسی دوباره». A paid one refreshes the plan and can be printed.
  - «پرداخت‌ها و فاکتورها» lists the last 100 checkouts with invoice number, status (including expired), plan, kind, cycle, amount, tracking code and card. Each row opens its page.
  - The plan card shows the paid cycle and «دوره‌های پرداخت‌شدهٔ بعدی» (scheduled renewals and downgrades from `upcoming`).
- Every BE-2.8 error code has a Persian message (`billing.plan.not_found`, `billing.checkout.*`).
- Mock Api host: plans, quote, checkout, history, a stand-in Zarinpal page with pay, cancel, bank error and no-answer, and `/__mock/billing/reset`. New e2e spec `billing-checkout.spec.ts`.
- API refreshed from backend main (BE-2.8).

## 0.16.0 — 2026-11-02

- Bulk price change (backend #38, BE-2.6):
  - «تغییر گروهی قیمت» on the products page and on the new «تغییر قیمت‌ها» tab: pick products by category (subcategories included), status and tag, or leave them empty for every product; raise or lower by a percent (−90 to 500, two decimals) or a Toman amount; round to 100 … 100,000 Toman, to the nearest, up or down. The products page's category and status filters carry over.
  - Preview lists every price that changes, old and new (the first 50, then a count), and any price that would reach zero, which blocks applying. Changing the form drops the preview, and applying sends its fingerprint; if the catalog changed in between the dialog refreshes the preview and asks again.
  - «تغییر قیمت‌ها» lists the last 50 changes with who made them, their scope and rule, and each price; undo within 24 hours restores the prices nobody changed since and says how many it left alone.
- API refreshed from the backend bulk-price branch.

## 0.15.0 — 2026-11-02

- Payment links (backend #37, BE-2.2, Zarinpal):
  - Settings «پرداخت»: connect the seller's own Zarinpal merchant account (36-character ID, shown back as its last four characters), pause it, switch the sandbox on, replace the ID or disconnect. Owners and admins change it; others see its state.
  - Order page «لینک پرداخت»: make a link for the order total (a complete draft moves to awaiting payment), copy or share it, see when it expires, how many attempts were made and the gateway's last error, cancel it, or make a fresh one (which cancels the old). Without a merchant account the card says so and links to the settings.
  - While a link is active the card checks every 15 seconds; when the customer pays, the order shows as paid with the tracking code and card. Earlier links are listed under «لینک‌های قبلی».
- API refreshed from the backend payment-links branch.

## 0.14.0 — 2026-11-01

- Orders (backend #36, BE-2.1, plan 3.8): «سفارش‌ها» in the menu and the mobile tab bar (it takes the channels tab's place; channels moves under «بیشتر»).
  - List: status tabs (all, draft, awaiting payment, to ship, shipped, delivered, cancelled and returns), search by order number or the customer's mobile, AI and flow orders marked. `?contact=` lists one customer's orders.
  - Detail: lines, totals, customer and address, what is still missing for shipping, links to the conversation and the contact. The allowed next statuses are buttons, each confirmed with an optional note; a timeline shows who did what (team, AI or system) and takes internal notes.
  - Create and edit drafts: catalog products (priced by the backend, with a variant per line) or custom lines with a title and price, shipping and discount in Toman, an estimated total, and a pasted address split into province, city, postal code and mobile. Line errors show on their line. Only drafts can be edited.
  - Printable invoice from the backend's Persian invoice; the panel shell hides itself when printing.
  - The inbox side panel and the contact page list the customer's orders with «سفارش جدید» prefilled.
- New permissions `workspace.orders.read` and `workspace.orders.write`.
- API refreshed from the backend orders branch.

## 0.13.0 — 2026-11-01

- Knowledge documents and web pages (backend #35): «سند» uploads a PDF, Word (docx) or text file up to 20 MB, which is virus-scanned and then read in the background; «صفحهٔ وب» adds a public https page, titled from the page unless a title is given. Their rows show the extracted text, a page's address and, on failure, why (scanned PDF with no text, unreadable file, page not reachable, too large or not a text page). Editing changes the title and a page's address; «خواندن دوبارهٔ صفحه» reads a page again.
- Customer photos: the inbox list, conversation header, contact list and contact page show the customer's Instagram photo when there is one, falling back to the initial when there is none or the signed link has expired.
- Backend gaps 7, 11 and 16 marked done.
- API refreshed from the backend branch for #35.

## 0.12.0 — 2026-11-01

- Web push (backend #33): Settings → Notifications has «اعلان روی این دستگاه» to turn push on or off for this browser and remove the user's other browsers. Hidden when the server has no push keys; on iPhone it asks to install the app first. The push column in the preferences table is enabled once push exists.
- The service worker (v2) shows pushes in Persian and opens their link in the workspace, reusing an open panel tab.
- The bell updates live from the inbox connection (`notification.created`) with a toast; polling drops to every 5 minutes as a fallback.

## 0.11.0 — 2026-11-01

- AI agent «آزمایش» (backend #29): chat as a customer and see what the assistant would answer, using the real settings and knowledge with nothing sent or stored. Each answer shows its outcome and confidence, «چرا این جواب؟» opens the full trace, and «جواب درست را یاد بدهید» opens a FAQ prefilled with the question and answer. Test customer tags show VIP handoffs. The panel keeps the last 20 turns as history.
- Knowledge «سؤال‌های بی‌جواب»: what customers asked that the knowledge base could not answer, with how often and the last conversation. Answer one (optionally reworded) to add it as a FAQ, or dismiss it; a dismissed question opens again when asked again. The tab shows the open count.
- Fix: a `useEffect` that returned `scrollIntoView(...)` crashed in browsers where it returns a promise.
- API refreshed from backend main.

## 0.10.0 — 2026-11-01

- AI agent (backend #28, BE-1.4 part 2): «دستیار هوشمند» replaces its placeholder.
  - Settings: the AI on/off switch (shared with the automation settings), name, tone, brand voice, reply in the customer's language, the minimum confidence to send a reply, never-say phrases, allowed link domains, the handoff rules (human request, complaint, discount request, two unsure answers, keywords, VIP tags) and the handoff message (or none).
  - «گزارش پاسخ‌ها»: every turn the AI handled, filtered by outcome or conversation, with a detail page: the customer's message, the reply or unsent draft, combined/model/classifier confidence against the threshold, intent, sentiment, the knowledge it used, tool calls, safety-check failures per attempt, models, tokens, cost and latency.
- Inbox: AI handoffs (`ai:<reason>`) read in Persian, the AI's unsure draft is labelled as such, and «چرا؟» opens that conversation's traces.
- API refreshed from backend main.

## 0.9.0 — 2026-11-01

- Knowledge base (backend #27, BE-1.4 part 1): «دانش کسب‌وکار» replaces its placeholder. Owners and admins add FAQ entries (question and answer) and text sources (title and body), edit, switch off and delete them. Active catalog products appear on their own; they can only be switched off, with a link to the product.
- Each source shows its indexing state (preparing, ready with its chunk count, or failed with the reason and a retry). The list polls while something is still being prepared, and filters by kind, status and text.
- «از دانش بپرسید» runs the agent's search on a sample question and shows the matching passages with their similarity.
- API refreshed from the backend knowledge branch.

## 0.8.0 — 2026-11-01

- Contacts / CRM part 2 (backend #26): «فرم‌ها» lists the flows that collected answers and each form's submissions (customer, time, conversation, answers in question order); the customer profile shows their answers too.
- Consent for promotional messages per channel (SMS, phone call, Bale) on the profile, with an optional note as evidence and the history (who and when). «ثبت نشده» is kept apart from a refusal. The list filters by consent and segments take a consent condition.
- Excel export of the filtered list: built in the background, polled while pending, and announced by a «crm_export» notification that opens the exports sheet on that file. Each file downloads once through a short link.
- API refreshed from the backend CRM part 2 branch.

## 0.7.0 — 2026-11-01

- Contacts / CRM part 1 (UP-1.11, backend #25): «مشتری‌ها» lists customers with search and filters by tag, segment, channel and phone, synced to the URL. Each customer has a profile: name (edit or clear), tags that save at once, custom fields by type (text, number, Jalali date, yes/no, email, phone, list) with per-field errors, and their conversations linked to the inbox.
- Tags: list with customer counts, colour, description, rename, and merge by renaming onto an existing tag.
- Custom fields: create with a suggested key (fixed once saved), edit label and options, delete.
- Segments: an editor with all/any matching, up to 20 conditions, and a live count of matching customers; the list links to the filtered contacts.
- Inbox side panel links to the customer's profile for users with CRM access.
- API refreshed from the backend CRM branch.

## 0.6.0 — 2026-10-31

- Billing v1 (UP-1.15, backend #23): «اشتراک» shows the current plan (subscription, free plan or no limits), trial badge and days left, and this Jalali month's usage per meter with a bar that turns amber near the limit and red when full (named in text, not by colour alone). Upgrades go through support until online payment exists.
- The plan-limit sheet names seats, Instagram accounts, AI conversations and the other meters; Instagram connect explains `reason=plan_limit`.
- Fix: every dialog shared one title id, so a dialog opened over another (the plan-limit sheet over the invite form) was announced with the wrong name.
- API refreshed from the backend billing branch.

## 0.5.1 — 2026-10-31

- Settings: «گزارش فعالیت» for owners (`GET /workspaces/{id}/audit`): who changed what and when, with support access shown as «پشتیبانی پیشخوان» with its reason, a filter (support, team, workspace), changed fields per entry, and paging. The «support» notification links here.
- API refreshed from backend main (notifications, support sessions and audit merged).
- Fix: a redirect loop (ERR_TOO_MANY_REDIRECTS) after signing in when the backend answered a server-rendered page with an error. Only a 401 now sends the user to `/login?expired=1`, which clears the dead cookies instead of bouncing back into the app; any other backend answer shows the error page and logs the path and status in the panel's server log.

## 0.5.0 — 2026-10-31

- Dashboard: live inbox numbers with the oldest waiting handoff, the overnight summary, and an activity card (today, 7 or 30 days) with who answered (rules, AI, team) as a share bar and daily stacked bars with a table for screen readers. Unhealthy channels are ringed in red. Viewers see analytics; agents keep the inbox counts.
- Notifications: a bell with unread count (polled every 60 s and refreshed on handoffs and channel changes), a sheet with the list, mark one or all read, and links into the panel; a settings tab for in-app and SMS per kind (push shows «به‌زودی»).
- Workspace deletion: owners delete from General settings by typing the name; a pending workspace shows its date in the list and a restore page for the owner.
- Support sessions: `/api/auth/impersonation?token=…` exchanges the admin panel's one-time token for a 30-minute support token kept in its own cookies. A red banner shows the staff member, a countdown and «پایان نشست»; password, two-step, sessions, billing and workspace deletion are hidden while it runs. `/support-ended` explains ended, expired and used links.
- Fix: sign-out now really clears the token cookies. Deleting a `__Host-` cookie without `Secure` was ignored by browsers.
- API refreshed from backend main plus the notifications branch (backend #17).

## 0.4.0 — 2026-10-31

- Automations: «تست پاسخ‌ها» runs a sample DM or comment through the rules (or one rule) and shows the outcome, business-hours state, what would be sent with variables filled in, other rules that also matched, and the flow it starts. Nothing is sent.
- Flows: «تست» chats with a flow (draft or published) turn by turn, with quick-reply taps as answers.
- Automation settings show the workspace business hours (the one set automations now read) with a link to edit them; the separate automation hours editor is gone.
- Product images on a saved product are added, removed and reordered at once through the new image endpoints.
- API refreshed from backend PR #14.

## 0.3.0 — 2026-10-29

- Inbox: customer names and @usernames from the API, search by name, username or phone, handoff reason with the suggested reply one tap into the composer, photos, voice notes, videos and the story a customer answered (with a placeholder once Instagram's URL expires).
- Team: pending invitations with revoke.
- API: refreshed from backend PR #13; the path-parameter patch in `scripts/gen-api.mjs` and the `unreadCount` number coercion are gone.

## 0.2.0 — 2026-10-29

- Automations: rules grouped by trigger with on/off and priority order, rule editor with a Persian keyword matcher that mirrors the backend's normalizer, message builder with a live DM preview, post picker, action editor; comment-to-DM wizard that can answer old comments; rule stats; automation hours and fallback reply.
- Flows: list, list-based builder with per-node inspector, server validation shown on each node, save and publish.
- Catalog: products (search, filters, infinite list), product editor with images, option/variant matrix and Toman prices, categories tree, storefront card sets with preview, Excel export/template/import with a followed job.
- Shared: file upload with virus-scan wait, money helpers (Rial/Toman), tabs, chips and money inputs, a test that every Persian message is valid ICU.

## 0.1.0 — 2026-10-29

- Next.js 16 panel with RTL Persian UI kit, next-intl catalog, Jalali/Toman formatting and a typed client generated from the backend OpenAPI document.
- BFF authentication (HttpOnly cookies, CSRF, single-flight refresh), request proxy with CSP nonces.
- Login (OTP + ALTCHA, password + TOTP), invitations, onboarding, workspace shell with banners, live inbox over SignalR,
  channels, team, settings, account, PWA basics.

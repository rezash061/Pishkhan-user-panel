# Changelog

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

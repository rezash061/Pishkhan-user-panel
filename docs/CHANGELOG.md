# Changelog

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

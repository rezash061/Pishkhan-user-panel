# Changelog

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

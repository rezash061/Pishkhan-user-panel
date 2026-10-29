# Changelog

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

# Pishkhan user panel

The customer panel of Pishkhan (پیشخوان): sellers, their teams and agencies answer Instagram DMs, run automations and
manage their shop here. Persian only, RTL, Jalali dates, Toman; mobile first and installable (PWA).

Plan: `04-user-panel.md` and `00-overview.md` in the project plans. Backend: [`pishkhan-backend`](https://github.com/rezash061/pishkhan-backend).

## Stack

Next.js 16 (App Router, route groups, `output: "standalone"`), React 19, TypeScript strict, Tailwind CSS 4,
TanStack Query 5, `@microsoft/signalr`, `next-intl` (fa-IR), `date-fns-jalali`, Vazirmatn (self-hosted, no foreign CDN).
The typed API client is generated from the backend's OpenAPI document with `openapi-typescript` + `openapi-fetch`.

## Run it

```bash
pnpm install
cp .env.example .env.local          # PISHKHAN_API_URL=http://localhost:5080
pnpm dev                            # http://localhost:3001
```

Without the .NET stack, a small mock of the Api host serves fake Persian data (OTP code `123456`; no realtime hub):

```bash
node tests/mock-api/server.mjs      # :5080
```

| Script | |
|---|---|
| `pnpm gen:api` | Regenerate `src/lib/api/schema.d.ts` from `openapi/api.v1.json` (copy the file from `backend/openapi/` after backend changes). |
| `pnpm check:api` | CI: fails if the generated client is stale. |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` | |
| `pnpm e2e` | Playwright on phone and desktop viewports against the mock Api host, with axe accessibility checks (run `pnpm build` first). |

## How it fits together

- **Route groups:** `(auth)` login and invitations, `(onboarding)` workspace + Instagram connect, `(app)` the
  workspace shell under `/w/[workspaceId]/*` and `/account`. `/channels` is the Instagram OAuth return URL
  (backend `Instagram:PanelReturnUrl`).
- **BFF (overview section 5):** the browser never sees tokens. `/api/auth/*` exchanges credentials and stores the access
  and refresh tokens in `HttpOnly` cookies (`__Host-` in production). Client code calls `/api/bff/*`, which adds the
  bearer token and enforces `Origin` + double-submit CSRF on mutations. Refresh is single-flight per refresh token,
  because the backend revokes a session when a rotated refresh token is reused.
- **`src/proxy.ts`** (Next 16 request proxy): per-request CSP nonce, route protection, and refreshing the access token
  before server components render.
- **Realtime:** one SignalR connection per open workspace (`/hubs/inbox`, same origin; `next.config.ts` rewrites it to
  the Api host, Nginx does it in production). Events update TanStack Query caches; after a reconnect everything on
  screen is refetched because pushes are best effort.
- **Permissions:** `src/lib/permissions.ts` mirrors the backend roles; nav and actions hide what the role cannot do.
  The backend still enforces everything.

## Status

Built against the backend's current API (Phase 0 through BE-1.6, plus backend PRs #13 and #14):

| Area | State |
|---|---|
| Phone OTP login with ALTCHA, password + TOTP login, sessions, profile, password, TOTP setup | Done |
| Workspace creation, picker, invitations (accept), team (invite, pending invitations with revoke, roles, remove) | Done |
| Onboarding: workspace → Instagram connect (official OAuth) → industry template (preview, apply, skip; again from settings) → import from posts (review products and FAQs) → teach the assistant (interview over the industry's required facts) | Done; import and test steps wait for their backend modules |
| Inbox: filters, virtualized list, thread, optimistic send with retry, 24-hour/7-day window, quick replies (`/`), notes, assign, status, AI pause, live updates, keyboard shortcuts, customer names, search, handoff reason and suggested reply, attachments and story replies, voice-note transcripts | Done |
| Channels: status, reconnect, disconnect, recent posts; banners for disconnected/expiring accounts and Instagram outages; «move my customers» SMS during an outage | Done |
| Settings: general, business hours with Jalali closed dates, quick replies, notifications, activity log (owner) | Done |
| PWA: manifest, icons, service worker with offline page, install prompt | Done; web push per browser (shows the notification and opens its link) |
| Automations: rules by trigger with priority order, rule editor (Persian keyword preview and tester, message builder with buttons/quick replies/variables and a live DM preview, post picker, actions), comment-to-DM wizard with old-comment backlog, rule stats, rule and flow dry-run testers, flows (list-based builder, server validation, publish), fallback reply (hours come from the workspace business hours), follow-gate step, scheduled follow-ups with their own page | Done; canvas flow builder is a follow-up |
| Catalog: products with filters, editor with images, option/variant matrix, Toman prices and stock; categories; storefront card sets with preview; Excel export, template and import job; bulk price change with preview and 24-hour undo | Done |
| Billing: current plan, trial, usage meters, plan-limit sheet; plans with new/renewal/upgrade/downgrade, quote, Zarinpal checkout and return page, payments and invoices, upcoming periods | Done |
| Contacts: list with filters, profile with tags, custom fields, consent and form answers; tags, custom fields, segments with live count, forms, Excel export | Done |
| Knowledge base: FAQ, text, document and web page sources, product sources on/off, indexing status with retry, test search, unanswered questions, knowledge score with facts checklist and suggestions, interview, products and FAQs from past posts with review | Done; documents (PDF, Word, text) and web pages too |
| AI agent: settings (persona, safety, handoff rules), test chat with corrections, reply log with trace details, AI handoff reasons in the inbox | Done |
| Orders (Phase 2): list with status tabs and search, detail with status changes, notes and timeline, create and edit drafts (catalog or custom lines, pasted address split), printable invoice, orders in the inbox side panel and on the contact page | Done; Zarinpal payment links with the merchant account in settings; the receipts queue comes next |
| Dashboard (live inbox, overnight summary, who answered by day), notifications (bell, list, preferences), workspace deletion with restore, support sessions with banner | Done; the bell updates live from the inbox connection; web push per browser |

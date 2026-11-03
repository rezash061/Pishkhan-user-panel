# Backend gaps found while building the panel

Found on 2026-10-29 against `backend/openapi/api.v1.json` from branch `feature/be-1.5-realtime`.

## Contract bugs

Items marked ✅ were closed by backend PR #13 (`feature/user-panel-gaps`) and the panel now uses them.

1. ✅ **Undeclared path parameters.** The Tenancy endpoints read `{workspaceId}` from the route without binding it, so the
   OpenAPI document leaves it out (8 operations: `GET/PATCH /workspaces/{workspaceId}`, `GET/PUT …/business-hours`,
   `GET …/members`, `PATCH/DELETE …/members/{userId}`, `POST …/invitations`). Typed clients cannot fill the path.
   The panel patches the document in `scripts/gen-api.mjs`; the fix is to bind the parameter (or add
   `.WithOpenApi` parameter metadata) so the document declares it. Fixed; the patch is gone.
2. ✅ **Integers typed `number | string`** (`unreadCount`, `limit`, `size`, …): .NET's default number handling in OpenAPI 3.1.
   Harmless, but `JsonNumberHandling.Strict` for the document would give clean `integer` types.

## Missing data the panel needs now

3. ✅ **Contact identity on conversations.** `ConversationResponse` has only `contactId`; the inbox shows «مشتری ۵۰۰۰».
   Needed: `contact { displayName, username, profilePicUrl }` on list and detail (or `GET /contacts/{id}`).
4. ✅ **Message attachments.** `MessageResponse` has `kind` and `text` but no attachment URLs or story/post previews,
   so images, voice notes and story replies cannot be shown.
5. ✅ **Conversation search** (`q` on the list: name, username, phone) — plan 3.3.
6. ✅ **Handoff suggestion on the conversation.** `handoff.requested` carries `suggestedReply`, but a conversation opened
   later cannot get it; add it (and the handoff reason) to `ConversationResponse`.
7. ✅ **SignalR CORS / same origin.** The hub has no CORS policy, so the panel must reach `/hubs/inbox` on its own origin
   (Next rewrite in dev, Nginx in production). Recorded in the backend's `docs/deployment.md` (backend #35).

## Endpoints for planned panel features (Phase 1)

8. ✅ Dashboard summary (`GET /workspaces/{id}/dashboard`: counts, answered by AI/rules/humans, overnight summary).
9. ✅ Pending invitations list and revoke (`GET/DELETE /workspaces/{id}/invitations`).
10. ✅ Notification preferences, workspace deletion with grace period, support-session token exchange (backend #18). Notification links point to `/settings/channels`; the panel's page is `/channels`, so the panel maps it.
11. ✅ Modules not yet in the API: AI agent settings + test chat + traces, knowledge (documents and web pages in backend #35),
    contacts/CRM/forms, billing/plans/usage, web push (VAPID public key + subscription endpoint, backend #33).

## Automations and catalog (BE-1.3, BE-1.6)

Items 12–15 were closed by backend PR #14; the panel now uses one set of hours, the dry-run endpoints and per-image endpoints.

12. ✅ **Two sets of business hours.** Automation settings keep their own weekly hours (`sun`–`sat`, `"HH:mm-HH:mm"`),
    separate from the workspace business hours in Tenancy, with a different shape and no closed dates. The panel offers
    «copy from workspace hours», but the two can drift. One source (or automation hours referencing Tenancy's) would fix it.
13. ✅ **No sandbox test run.** There is no endpoint to run a rule or flow against a sample message without a real
    conversation; the panel tests keywords locally only. Plan 3.6 asks for a «test» panel.
14. ✅ **Product images only through the product.** Images are attached by `fileId` inside the product PUT; there is no
    endpoint to add, remove or reorder one image, so every image change re-sends the whole product.
15. ✅ **Automation hours** (12) are moving to the workspace business hours in a coming backend PR, together with product
    image and test-run endpoints (13, 14). The panel will drop its separate automation-hours editor then.
16. ✅ **Contact profile picture.** `ConversationContact` has no `profilePicUrl`, so avatars are initials. Backend #35 adds
    `profilePicUrl` (a 6-hour signed URL, or null) to conversations and CRM contacts; older contacts keep initials.

## Subscription checkout (BE-2.8)

Found on 2026-11-03 against backend main after PR #39.

17. **The checkout return URL has no workspace.** `{ReturnUrl}?checkout={id}&status=` is the same for every workspace, and `GET /checkouts/{id}` is scoped to a workspace. The panel therefore saves the workspace in a `pk-checkout` cookie before it leaves for Zarinpal, falling back to the last workspace opened. If the payer comes back in another browser, they land in the wrong workspace and see «پیدا نشد». Adding `&workspace={id}` to the redirect would fix it.
18. **`Billing:Checkout:ReturnUrl` defaults to `http://localhost:3000/billing`.** The panel runs on :3001, and `appsettings.Development.json` has no `Billing:Checkout` section, unlike `Instagram:PanelReturnUrl`. It should be `http://localhost:3001/billing` (the panel's `/billing` route).
19. **Upcoming subscriptions have no plan name.** `SubscriptionResponse` carries only `planCode`. The panel looks the name up in `GET /billing/plans`, so a plan taken off sale shows its code. A `planName` field would fix it, as `CheckoutResponse` already has.
20. **No invoice document.** A paid checkout is the invoice, but there is no Persian invoice endpoint like the orders' `/invoice` (seller's details, Pishkhan's details, VAT). The panel prints the checkout page for now.

## Industry templates (BE-2.9)

Found on 2026-11-03 against backend main after PR #40.

21. **Onboarding progress is not stored.** Plan 3.1 asks for every step to be resumable "state from backend". There is no onboarding state endpoint, so a user who leaves the template step lands on the dashboard next time. Today `lastApplied` on the templates is the only trace.
22. **Template FAQs and rules are not marked in their own lists.** Applied FAQs and rules carry a template key on the backend, but `SourceResponse` and the rule response do not expose it. The knowledge and automation pages therefore cannot filter «from the template, still off» or point at the items with blanks to fill.

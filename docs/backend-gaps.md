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
7. **SignalR CORS / same origin.** The hub has no CORS policy, so the panel must reach `/hubs/inbox` on its own origin
   (Next rewrite in dev, Nginx in production). Fine, but worth recording in the deployment docs.

## Endpoints for planned panel features (Phase 1)

8. Dashboard summary (`GET /workspaces/{id}/dashboard`: counts, answered by AI/rules/humans, overnight summary).
9. ✅ Pending invitations list and revoke (`GET/DELETE /workspaces/{id}/invitations`).
10. Notification preferences, workspace deletion with grace period, support-session (impersonation) token exchange.
11. Modules not yet in the API: AI agent settings + test chat + traces, knowledge,
    contacts/CRM/forms, billing/plans/usage, web push (VAPID public key + subscription endpoint).

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
16. **Contact profile picture.** `ConversationContact` has no `profilePicUrl`, so avatars are initials.

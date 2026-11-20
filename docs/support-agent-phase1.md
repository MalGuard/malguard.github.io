# MalGuard Support Agent — Phase 1 foundation

Status: **development only; not deployed or connected to the production report form**.
This phase intentionally preserves `/ai/`, `/report.html`, and the existing report email endpoint.

## Owner-approved product scope

- Only replace the optional MalGuard AI guidance *inside support and bug reporting*.
- Keep the standalone MalGuard AI product untouched.
- Support account sign-in and single-ticket, one-time email access links.
- Accept bug text, screenshots and logs after upload validation. No untrusted attachment execution.
- Require separate approval **per attachment and redacted version** before any model receives content.
- Support Agent can analyze approved redacted attachments. Security/Quality AI reviewers receive only a separately redacted evidence summary, patch and test results.
- Public GitHub repository read is allowed. Private repository read requires ticket-scoped owner approval until ticket closure; reopening does not restore the grant.
- Sending any excerpt of private code to an external AI needs a separate owner-reviewed redacted preview and approval.
- Code changes need owner and reporter permission. Both independent AI reviewers and required CI must approve the exact commit; owner approves deployment separately.
- Reporter or verified owner-admin can close a ticket. Reporter can reopen within seven days. Attachments are due for deletion 30 days after closure; reopening cancels the due date. Closing by an admin requires a reason.

## Implemented on this branch

- `services/support/server/ticket-policy.mjs`: pure, fail-closed domain checks for ticket reads, close/reopen, attachment-analysis consent, due-for-deletion checks and commit-bound review/deployment gates.
- `services/support/server/email-link.mjs`: cryptographically random 32-byte token, SHA-256 token hash, 15-minute TTL and verification bound to one ticket/email, with consumed/revoked checks.
- `services/support/supabase/support-schema.sql`: *proposed migration*, not executed. Tables for tickets, messages, attachments, permissions, access links, reviews and audit events. Enables RLS with no permissive client policies and revokes direct access from browser roles.
- `tests/support-ticket-policy.test.mjs` and `tests/support-email-link.test.mjs`: automated invariant tests; CI runs them on the PR.

## Not implemented or verified yet

No durable support API, mail delivery, database migration, upload endpoint, privacy-redaction processor, ticket chat, cleanup scheduler, actual three-agent runner, GitHub App authorization, deployment approval workflow or production authorization has been deployed. The review logic is a required gate for future services, **not** proof that an AI review or CI run actually occurred. The schema is not evidence that production Supabase RLS has been validated.

The existing report form continues to use the preexisting email service and optional guidance. Do not label a report as stored, delivered, investigated or resolved unless the actual backend confirms that specific stage.

## Required integration boundaries

1. **Identity:** adapt the existing Game Scam Guard account auth. Validate session server-side and bind the account to a verified email. Email-link access must be restricted to the one ticket, and links must not be able to authorize administrative actions. Do not trust a browser-supplied `role`, `verified`, `ownerEmail`, `ticketId`, or storage path as proof of authority.
2. **Email links:** issue by backend after rate-limited request and non-enumerating response. Send token via email using a fragment-based handoff, strip fragment immediately, and POST token to redeem. In a database transaction, mark `consumed_at` only when currently unused/unrevoked and not expired; check that exactly one row was updated before issuing a separate short-lived ticket session. Never log or store raw tokens, or place them in URL query strings.
3. **Persistence:** use server-controlled Supabase credentials only. Map `guard_accounts` to tickets via account ID when available, and retain verified owner email for ticket-scoped access. Each mutation must be transactional with version checks to block race conditions and avoid duplicate closure/resetting retention periods. The `support_tickets` closed-time database constraint must be satisfied on every update.
4. **Uploads:** use a **new, private** Supabase Storage bucket. Validate type from actual bytes, restrict size (images <=5 MiB each, logs <=2 MiB), reject executable/archives, quarantine unvalidated content, normalize/strip image metadata, parse logs only as data, remove sensitive fields in a separate candidate copy, and require preview/reconsent after any candidate change. Do not expose original objects to models or to reviewers. Server must check consent and exact redacted digest immediately before model calls; revoke blocks *future* processing, not already-processed input.
5. **Cleanup:** schedule server-side 30-day deletion by closed ticket `attachments_delete_at`. After storage deletion, set attachment state/deleted_at and record audit outcome. Retry transient failures, and never claim success without confirming deletion. Check provider backup-retention details before promising total removal.
6. **Agents and GitHub:** keep provider keys on server. Treat user messages, logs, and code comments as untrusted. Read-only GitHub App installations should be narrowly scoped. Private repo access revokes on ticket closure; reopen requires a new grant. Never allow an AI tool to merge/deploy, browse secrets, or self-approve permission.
7. **Human support:** give the reporter a direct choice between AI and human support, and a visible handoff if the AI cannot verify its answer. Configure `contact@malguard.site` for general support while preserving the security-report channel as a separate pathway.

## Verification before live rollout

- Run `node --test tests/support-ticket-policy.test.mjs tests/support-email-link.test.mjs`.
- Test two real isolated synthetic user accounts, expired/replayed links, cross-ticket access, forged admin roles, attachment re-consent/revocation, user vs admin close behavior, 7-day boundary, 30-day cleanup and transient storage failures.
- Test mobile widths 390/768/1440, both languages and keyboard navigation.
- Validate real provider delivery and a **private** Supabase bucket with owner-controlled test accounts.
- Merge or deploy **only after** test evidence is inspected and the owner explicitly approves.

## Implementation order

Phase 1a (this PR): policy primitives, database design, unit tests and CI.
Phase 1b: backend with Supabase persistence, existing account validation and ticket-bound email redemption.
Phase 2: chat UI, attachments, privacy guard, real cleanup scheduling.
Phase 3: agent orchestration, independent reviewers, permissioned GitHub operations.
Phase 4: integration/security/browser tests, owner review and separate deployment approval.


## Phase 1b implementation (feature-flagged)

The server-only backend is now implemented in `services/support/server/`:
- `support-http.mjs`: protected JSON HTTP routes, explicit trusted origins, rate limiting and fail-closed error responses.
- `support-store.mjs`: uses Supabase PostgREST from the server only. It does not expose service-role credentials.
- `support-identity.mjs`: validates existing Game Scam Guard account sessions and confirms the account still exists in `guard_accounts`; issues 30-minute signed sessions scoped to one ticket following link redemption.
- `support-mail.mjs`: Brevo link delivery and Cloudflare Turnstile verification for unauthenticated creation and link requests.
- `api/support.js` and `vercel.json`: dedicated Vercel entry point and rewrite. Account verification stays with the existing MalGuard email identity backend.

### API (not enabled in production)

All operations except status require JSON POST. Read/write operations accept an `Authorization: Bearer <server-issued-session>` header. Do not place account or support session tokens in URLs. Browser origins are restricted to approved first-party hosts; server authentication is enforced separately.

| Path | Contract |
| --- | --- |
| `GET /api/support/status` | Config status only, **not** live provider verification |
| `POST /api/support/create` | `kind,subject,message`, plus account session or guest `email,turnstileToken` |
| `POST /api/support/list` | Only a verified persistent MalGuard account; account's own tickets |
| `POST /api/support/ticket` | `ticketId`; authorized ticket + last 50 messages |
| `POST /api/support/message` | `ticketId,message`; only authorized owner, if open |
| `POST /api/support/close` | `ticketId`; only verified reporter at this stage |
| `POST /api/support/reopen` | `ticketId`; reporter only and within seven days |
| `POST /api/support/request-link` | `ticketId,email,turnstileToken`; non-enumerating response |
| `POST /api/support/redeem-link` | `ticketId,token`; atomic single-use redemption, 30-minute ticket session |

The security-report kind remains on the existing dedicated private-report path. This API currently accepts bug, false-positive and feedback tickets only; it does not send security disclosures to models.

Magic links contain a secret in the URL **fragment**, not a query parameter; a future `support-ticket.html` page must immediately clear the fragment via `history.replaceState` before the POST redemption call. Account sessions and ticket access sessions must be stored in page memory rather than persistent browser storage.

### Database migration (not applied to production)

1. Review and run `services/support/supabase/support-schema.sql`.
2. Review and run `services/support/supabase/support-rpc.sql`.
3. Verify `service_role` grants, RLS/default-deny browser roles, PostgREST exposure, SQL RPC transactionality and security advisors in the **actual intended project** before enabling the API. The scripts are SQL drafts rather than a deployed migration.
4. Validate 2-account isolation and live provider behavior in an owner-controlled staging environment.

The SQL functions are `SECURITY INVOKER`; `EXECUTE` is restricted to `service_role`. Supabase service-role bypasses RLS, so all browser-facing access MUST be checked in the backend. `support_close_ticket` and `support_reopen_ticket` atomically update status, retention time, revision and audit events; `support_redeem_link` consumes its hash atomically. Read-side actor construction must always derive from trusted session verification.

### Configuration gates

These environment variables are server-only and must be configured securely; no values belong in source control:
- `SUPPORT_API_ENABLED` = `true` **only after** staged verification. Its default is off.
- `SUPPORT_SESSION_SECRET`: dedicated cryptographically random secret of at least 32 characters for signed ticket sessions and rate-key HMACs.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: existing trusted Supabase connection, never the browser.
- `BREVO_API_KEY`, `AUTH_FROM_EMAIL`: required by existing MalGuard account validation.
- `SUPPORT_FROM_EMAIL`: a provider-verified support sender, intended `contact@malguard.site`.
- `SUPPORT_PUBLIC_URL`: approved HTTPS `https://malguard.site/support-ticket.html` after the landing page actually exists.
- `SUPPORT_TURNSTILE_SECRET`: Turnstile server-side verification key; frontend must use matching `support_create` / `support_request_link` actions.

**Do not enable** before the magic-link landing page, verified mailbox, Turnstile frontend and stage database are wired and tested. Sending a link to a missing page would create a broken user experience.

### Verification evidence and limitations

- `tests/support-http.test.mjs`: isolated HTTP checks for cross-account BOLA/IDOR, replay, abuse limits, untrusted admin fields and state changes.
- `tests/support-identity.test.mjs`: signed-session integrity/expiry, account backing record, mail and Turnstile boundaries.
- `tests/support-sql-smoke.sql`: live PostgreSQL checks for revocable role grants, atomic RPCs, link replay, revision state changes and private GitHub grant revocation. CI uses an isolated PostgreSQL 16 service; no production data.
- `.github/workflows/support-policy-tests.yml` and `.github/workflows/support-database-tests.yml` run these tests.

**Not yet implemented:** admin close from a securely authenticated administrator, support ticket UI, verified real email delivery, persistent session revocation, attachments and redaction, 30-day cleanup execution, human routing, AI orchestration and private GitHub App approval. The existing account service's previously documented challenge replay/attempt-limit concerns remain an independent security blocker for production rollout. AI model responses do not prove actual repairs.

GitHub PR must stay draft and unmerged until full integration, production-ready auth review, test inspection and owner approval.

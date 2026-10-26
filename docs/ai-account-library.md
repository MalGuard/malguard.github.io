# MalGuard AI navigation and account library

## Scope and design

Preserve the existing three modes, security permissions, local-model downloads and opaque code preview. Move the product-name switcher to a quiet left sidebar with descriptive choices, recent chats, search, memory and settings. Default to English independently of the main website language. Put language selection inside settings. GitHub and Notion remain explicitly not connected.

## Data boundary

The existing Game Scam Guard email/password or email-code login issues an opaque session. The library API validates that session using the existing server implementation. The token stays in browser memory, never localStorage/sessionStorage, logs, model input or source control. Reopening the page requires sign-in again. This change does not claim global session revocation or fix the previously identified verification-challenge replay issue.

Signed-in text conversations and explicitly entered notes are stored using the existing Supabase Storage service. No new subscription, provider or paid fallback is enabled. The fixed `malguard-ai-library-v1` bucket must be private. The API creates it if absent, checks its private status on each operation, and refuses operations if it is public. Provider credentials remain exclusively on the server. Object ownership is a server-derived SHA-256 identifier of the authenticated normalized email; caller-supplied paths, owners and buckets are rejected. No public URL or signed download URL is returned.

Supabase service-role requests bypass RLS. Isolation therefore depends on the authenticated API ownership boundary, tested with two synthetic accounts; this is not evidence that database RLS has been inspected in production. Changes do not alter guard_accounts or existing authentication tables.

Only user and assistant text is stored. Original attachments, binary files, arbitrary tool evidence, editor/project files and executable report objects are excluded. Generated code that appears in assistant chat text is conversation text and can be stored. Restored messages render as text/code; they never automatically apply a project or execute a preview. Notes are visible and removable in Memory and are not automatically included in model requests.

## Limits and failure behavior

30 chats/account, 64 text messages/chat, 12,000 characters/message, 20 memory notes of at most 1,000 characters, and 256 KiB total serialized library. Server schema validation and the private bucket's object-size limit enforce the storage bounds. An archived chat remains stored and counts toward the limit. Archive is reversible storage, not permanent deletion. There is no background automatic purge or account-deletion implementation in this phase.

Saves are serialized within a page; server reads/writes use bounded timeouts and never retry indefinitely. Storage errors show “Not saved”; the application remains usable in page memory. Multiple tabs/devices can overwrite the same library (last completed write wins); this is not a collaborative database. Request rate limiting is in-process and per opaque session, not a distributed global quota. Existing provider free-tier/billing ceilings are not verified by this change.

## Verification

- `node --test services/game-scam-guard/server/ai-library.test.js services/game-scam-guard/server/email-auth.test.js`: owner isolation, rejected caller paths, public-bucket failure, schema bounds, existing authentication.
- `node tests/malguard-ai-library.mjs`: English default despite legacy website language, sidebar mode picker, save/reload/sign-in, memory, sign-out and second-account isolation at 390/1280px, with controlled synthetic API fixtures.
- Existing account and builder browser tests retain consent, opaque preview/no network, opt-in code sharing, Undo and account-clearing coverage.

Production private-bucket creation, authenticated round-trip storage and live account isolation must be separately verified before being reported as live verified. The UI must show unavailable rather than claim saved when provider configuration or access is missing.

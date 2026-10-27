# Local Debug Center Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation; one final branch review.

**Goal:** Give the owner a usable isolated local environment to test account protection, inspect safe logs and request bounded analysis from existing authorized models.

**Architecture:** A loopback-only Node service owns an in-memory PostgreSQL test database, two authentication instances and synthetic storage transport. A separate browser page reads only staging metadata. Repair analysis sends a validated safe report to fixed existing model endpoints, with a second approved reviewer and strict budgets; absent a safe code executor/publishing credential the result remains MANUAL_REVIEW and never executes model output.

**Tech Stack:** Node/Express, dev-only PGlite, existing account/library/telemetry modules, static HTML/CSS/JS, existing Cloudflare model gateway.

**Spec:** User's master prompt plus 27 October instruction: prepare staging, explain viewing logs, connect AI for repair. No Production access/writes, cost activation or appearance change.

## Constraints and rulings
- No real mailbox, credentials, account data or Production database is loaded. The test mail transport remains entirely local.
- PGlite is real PostgreSQL SQL in one embedded environment; it is not a cloud Supabase instance or multi-backend concurrency certification.
- Host and browser Origin must match the exact loopback address; API requires an ephemeral staging session header. No wildcard CORS or public binding.
- Only existing fixed approved models may receive allowlisted diagnostic metadata. At most two calls/job, one job at a time, and a bounded total per service lifetime. Provider output is untrusted text.
- Ruling: without a safe general code executor and scoped PR-publishing identity, retain MANUAL_REVIEW rather than run arbitrary AI code or claim autonomous Production repair.
- Review focus: cross-origin/Host rebinding, logs leaking inbox codes, malformed/oversized provider responses, concurrent jobs exceeding budgets, shutdown/ephemeral data cleanup.

## Tasks
- [ ] Test and implement local PostgreSQL/RPC/account isolation harness, retaining original auth/security controls.
- [ ] Test and implement strict safe repair-report serialization, fixed-model connection, time/output/call budgets and independent review.
- [ ] Test and implement protected loopback HTTP service and safe log viewer with Request ID search and Copy Safe Debug Report.
- [ ] Run synthetic end-to-end authentication and browser checks; make one authorized metadata-only model connection check if available.
- [ ] Review the branch once, document startup/limitations and open a draft dependent PR. Do not merge or deploy.

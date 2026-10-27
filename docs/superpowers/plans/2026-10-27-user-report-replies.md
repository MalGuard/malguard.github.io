# User report replies

Requested flow: a separate report page, description and reproduction steps, explicit external-model consent, immediate bounded AI first response and tracking receipt. Continue the existing local staging implementation; no Production deployment or appearance changes. Local UI must clearly say reports are not delivered to the site operator or durably stored. General public intake and authenticated durable storage remain separate rollout work.

Implementation: support.mjs validates and redacts bounded input; one fixed existing Workers AI model, max six calls per process, one active call, 30s timeout, bounded response, no retries/execution. Report page gets a separate scoped session token, never the admin token. No report text in telemetry. No listings, cross-user history or raw errors. All output textContent.

Validation: tests for consent/limits/redaction, disabled/outage/budget/concurrency, HTTP token scope and report flow; browser submit a synthetic report with real existing model. Save evidence, commit branch and draft dependent PR. Do not modify the unrelated externally deleted analysis fixture.

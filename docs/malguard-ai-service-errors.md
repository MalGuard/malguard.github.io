# MalGuard AI service failures

Model and web-search failures retain safe error codes through the server gateway,
orchestrator and browser, including the NDJSON terminal response. Rate limiting,
exhausted quota, account credit/billing requirements, rejected credentials,
unconfigured models, timeouts and unavailable services have distinct messages.
HTTP 402 does not prove a subscription expired; the UI asks the administrator to
check account credit/billing rather than claiming an expiry date.

For rate limits, the gateway reads the provider's `Retry-After` (seconds or HTTP
date), or Google's structured `google.rpc.RetryInfo`. It returns a validated UTC
`retryAt` and `retryAfterSeconds`. The browser renders the date and time in the
device's timezone with a timezone label. Application rate limits return their
actual remaining window. There is no automatic retry or model fallback.

If the provider does not supply a reset time, the UI explicitly says that it is
unknown. A shared account quota is not represented as a per-user entitlement.
Upstream bodies, credential values and account identifiers are never rendered;
only allowlisted codes and validated timing metadata cross the boundary. A
Worker's unstructured error cannot prove a quota/reset and remains a generic
model failure. No Worker deployment or billing setting is changed.

Verification: Node tests cover HTTP and streamed limits, missing/invalid timing,
Google retry metadata, credit and credential failures, redaction, gateway to UI
propagation and the application's actual remaining rate window. Browser fixtures
cover localized timezone display, HTTP/NDJSON failures, unknown reset times,
language switching and preservation of the submitted text. These tests do not
exhaust a live provider quota or simulate success from a real model.

This release also includes the saved clean-chat layout and optional on-device
model offer. On compatible WebGPU devices the offer presents Download and Later;
no model weights download before explicit consent. Real inference on physical
phones remains unverified.

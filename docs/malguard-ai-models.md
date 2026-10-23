# Stronger models and response language

The original public client defaults to English. That must not force an English
answer to a Persian message. Response language now follows the actual user text,
an explicit language instruction, or the preceding user turn for a numeric or
emoji-only continuation. UI locale remains independent and falls back only when
the conversation supplies no language signal.

The server-approved model identifiers are:

| Identifier | Provider / model | Activation |
| --- | --- | --- |
| `llama70b` | Existing Workers AI Llama 3.3 70B | New default; existing Worker credential |
| `llama8b` | Existing Workers AI Llama 3.1 8B | Explicit alternative; existing Worker credential |
| `gemini_flash` | Gemini 3.8 Flash | Existing Gemini key plus confirmation that billing is disabled |
| `groq_qwen` | Qwen 3.8 27B on Groq | Owner-provisioned Groq key plus nonbillable account confirmation |

The browser chooses only an identifier, never a provider URL or credential.
Disabled catalog entries are visible but cannot be selected. The gateway checks
readiness and model identity again. No automatic provider fallback is performed.
The reply identifies the actual provider and model, and has its own text direction.
Only conversation text can reach models; security evidence remains separate.

The private gateway stores the credentials and the free-account flags
`MALGUARD_AI_GEMINI_FREE_CONFIRMED` / `MALGUARD_AI_GROQ_FREE_CONFIRMED`. These flags
do not change provider billing or create free accounts. Without the applicable
credential and confirmation, those providers remain disabled. The existing
Cloudflare account/quota is reused without a paid upgrade. Its operator must keep
it on the free plan to prevent charging beyond the daily free allowance.

Free APIs have quotas. Current official references checked 23 October 2026:

- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Groq free limits](https://console.groq.com/docs/rate-limits)
- [OpenRouter pricing](https://openrouter.ai/pricing): researched but not connected;
  a separate key and provider-specific data/limit review would be necessary.

No new provider account, API key or paid plan was created automatically. Credentials
must never be pasted into chat or client source.

Validation: 38 assistant tests, 12 gateway/model tests, browser checks at
360/390/768/1280 px, syntax/static checks, and the public build passed. The browser
test keeps the UI English while submitting `سلام`, selects the alternative model,
and verifies that the backend requests Persian from that selected model. Provider
responses in these new regression tests are injected fixtures; live 70B/Gemini/Groq
inference is not claimed by those tests.

Release order: deploy and verify the private gateway first, then publish this
client/server branch. The new public backend expects the new gateway catalog and
identity contract. Automatic approval review rejected the new production gateway
deployment pending explicit approval for this subsequent release. The earlier
3B release remains live until that approval and successful live verification.

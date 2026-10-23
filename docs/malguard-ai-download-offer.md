# Optional on-device download

On compatible devices, Settings → On-device models offers two local models
with Download and Later actions. The user selects one model before downloading:
Qwen3 0.6B (approximately 352 MB) or Qwen3 1.7B (approximately 985 MB).
The dialog also discloses estimated GPU memory, download hosts, caching, and
possible battery/data/storage usage. Actual device inference remains unverified
on physical phones; WebGPU feature detection alone cannot guarantee success.

Entering the page does not fetch model weights. Download explicitly prepares
only the selected model without generating or uploading a conversation. Later
and Escape close the offer and retain the available default cloud model.
The choice lasts for the current tab session. Users can still select a local
model later in Settings, with separate approval for its download. Unsupported
devices do not receive the download offer. Existing settings allow stopping
local inference/download and removing cached models.

The interface says **without a provider's daily message quota**, rather than
promising unlimited speed, capacity, memory, offline web search, or storage.
Web search still needs network access, consent, and a configured search service.

## Cloud candidates for use without model downloads

These are researched candidates, not newly activated integrations. Official
documentation checked on 23 October 2026:

| Role | Candidate | Verified allowance and limits |
| --- | --- | --- |
| Fast, short conversation | Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) | The official pricing page lists free input/output. Exact RPM, TPM and daily quotas must be checked for the owner's project in AI Studio; a high request allowance is not yet verified. |
| Medium, multilingual tasks | Cloudflare Qwen3 30B A3B (`@cf/qwen/qwen3-30b-a3b-fp8`) | Workers AI includes 10,000 free neurons per day, shared across the account's model usage. The published rates are 4,625 neurons per million input tokens and 30,475 per million output tokens, so message capacity depends on conversation length. This is not a separate quota for each site visitor. |

Sources:

- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini quotas](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Qwen3 30B model](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/)

For research, connect the medium model to the existing search tool with its own
quota and consent checks. Gemini 3.5 Flash-Lite's built-in Google Search is not
listed for its free tier. No extra search integration is enabled here.

Neither candidate is guaranteed to be the least restricted API. The free Gemini
project's actual allowance and live Persian quality must be verified before
choosing or activating it. An owner must keep services on nonbillable plans;
application flags alone do not enforce a provider's billing policy. No paid plan,
new account, credential, or production deployment is created by this change.

Groq's current model catalog labels Llama 3.1 8B and Llama 3.3 70B as Enterprise.
Do not reuse historical 14,400-free-requests/day claims for them without checking
the owner's actual account access and current terms.

- [Groq model catalog](https://console.groq.com/docs/models)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)

## Quiet landing page

The model offer now opens from Settings → On-device models, rather than
automatically on entry. Download and Later remain explicit choices; selecting
a local model for chat still asks for download approval when needed.

## Validation

Unit tests cover explicit preparation without a conversation and model-ID
validation. Browser tests use a mock Worker to verify that entering, choosing
Later, cancelling and pressing Escape never start a download; only Download
prepares the selected model. They do not claim live weight downloads or real
GPU inference. No model weights are downloaded by these checks.

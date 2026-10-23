# Quiet chat interface

The `/ai/` landing view contains a heading, a compact rounded composer and a closed Settings disclosure. Mode, model, permissions, tool selection and service diagnostics remain available inside Settings. Missing consent opens the relevant controls before any request is sent.

Model replies use plain text without a surrounding result card or prominent provider heading. Copy and a closed Response details disclosure expose the original response and provider identity. Security outcomes remain explicit; evidence, timestamps, sources and limitations remain available under Inspection details. The existing English default and Persian RTL switch remain supported.

## Verification

- 38 AI backend/unit tests passed; static safety and syntax checks passed.
- Browser integration passed at 360, 390, 768 and 1280 pixels, including real benign static file analysis, consent blocking, RTL/LTR, hidden model controls, retained inspection metadata, collapsed model identity, conversation history, and unavailable-backend behavior. Model text in these UI tests is an injected fixture, not live inference.
- Production build passed, validating 48 HTML documents and excluding server/test sources from public output. Existing Vite warning about `./fonts/vazirmatn.css` remains.

## Anonymous provider investigation

The legacy Pollinations endpoint returned a real anonymous response to a harmless arithmetic prompt. Its public `/models` endpoint identifies the anonymous model as GPT-OSS 20B (`openai-fast`). An immediate subsequent request returned HTTP 402 and a one-response-per-30-seconds-per-IP limit. This is insufficient for a shared production chat service, so no new provider is enabled or silently substituted. Current documentation for the newer API requires an API key; do not assume anonymous access applies to all endpoints.

The AI Horde text-model status endpoint returned HTTP 403 in this environment, so availability was not verified. No account, key, paid resource or new model activation was created. Existing authorized model connections are unchanged.

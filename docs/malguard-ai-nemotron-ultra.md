# NVIDIA Nemotron 3 Ultra in MalGuard AI Code

This is an **opt-in, server-side** code assistant provider, not OpenAI Codex.
It builds on the existing MalGuard AI architecture without replacing security
scanners, local WebGPU models or previous Cloudflare/Groq/Gemini providers.

## Activation

The gateway is hosted in the separate `MalGuard/malware-ai` repository and
Vercel project. Its matching gateway branch must ship to Preview before this
client branch is tested. The new browser model ID is
`nvidia_nemotron_ultra`. Its model name is
`nvidia/nemotron-3-ultra-550b-a55b`.

1. Generate a trial key at
   https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b
2. Open the **malware-ai** Vercel project > Settings > Environment Variables.
3. Set `NVIDIA_API_KEY` to the key and
   `MALGUARD_AI_NVIDIA_ENABLED=true` for Preview. No keys go in GitHub,
   browser JavaScript, or chat messages.
4. Redeploy Preview. GET the gateway endpoint to verify only status/catalog
   metadata is returned, with `nvidia_nemotron_ultra` configured.
5. Test a consented Code-mode completion with code proposal/preview and compare
   with the existing Code model; verify error handling and provider identity.
6. Review usage limits, privacy, and access before separately authorizing
   Production. Trial/free endpoint status does not mean unlimited production
   hosting. Do not deploy to Production automatically.

When not configured, NVIDIA stays disabled and Code continues to use
previously configured models. If the key is revoked or quota ends, explicit
NVIDIA requests fail clearly; no secret or internal provider body should reach
the client. Automated routing falls back to an available configured model.

The browser sends only authorized conversation text to the server gateway;
never include private keys in prompts. User code appears in prompts only with
the existing Code-mode explicit sharing option. Inferred API availability
and the fixture-backed test results are not proof of live execution.

Public contract tests: `services/malguard-ai/test/nvidia-code.test.js`.
Private gateway tests: `tests/assistant-nvidia.test.mjs`.

## Preferred free option: OpenRouter Nemotron 3 Ultra

The Code assistant now supports the free model ID `openrouter_nemotron_ultra`, routed on the server to `nvidia/nemotron-3-ultra-550b-a55b:free` through OpenRouter. This uses an **OpenRouter key**, not an NVIDIA Build key, and does not enable paid routing.

Use https://openrouter.ai/settings/keys to create the key. Store it in the **private** Vercel `malware-ai` project under `OPENROUTER_API_KEY` for Preview only, then deploy the private and public companion Preview branches. The model is disabled in the catalog until the server environment supplies that key. The existing Cloudflare/Groq/Gemini options remain unchanged.

The free account limit is typically 50 requests/day and 20 requests/minute. Do not send private source files, secrets or personal data into this provider; the free endpoint can log data for model improvements. Test live requests, response model metadata, project proposal format, and usage limits before approving Production. See https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b%3Afree


### Preview-only end-to-end verification (do not merge to Production)

1. Confirm in private \`malware-ai\` Vercel project that \`OPENROUTER_API_KEY\` is a Sensitive variable targeted **Preview**. Never expose or copy its value into any web client.
2. Once the deployment quota allows it, deploy the \`feature/nvidia-nemotron-ultra-code-20261030\` branch of \`MalGuard/malware-ai\` to Preview and **verify its commit SHA matches PR #49**.
3. Open \`https://<actual-malware-preview-host>.vercel.app/api/malguard-assistant\` and check the **GET** catalog reports \`openrouter_nemotron_ultra\` as \`configured\`; no secret should appear in JSON. For a protected deployment, use the Vercel Preview protection flow rather than disabling protections.
4. In the Vercel project serving the public assistant backend (\`game-scam-guard-connected\`), add **Preview-only** \`MALGUARD_AI_PREVIEW_GATEWAY_URL\` equal to that verified preview gateway endpoint, including \`/api/malguard-assistant\`. The code validates the URL host belongs to the known Vercel team. Production ignores this variable.
5. Deploy PR #318 of \`MalGuard/malguard.github.io\` to Preview and confirm the Code mode chooses \`openrouter_nemotron_ultra\`, the chat endpoint returns an actual free Nemotron response, no keys are emitted, and a synthetic 429 is safely handled. If the private Vercel Preview is protected from service-to-service traffic, configure a safe server-side preview access mechanism before testing; do not turn off protection globally.
6. Without Cloudflare Preview credentials and an explicit free-usage confirmation, a 429 from OpenRouter correctly surfaces a controlled \`provider_rate_limited\`/\`provider_quota_exhausted\` status. Never route to a paid model without explicit approval.
7. Only after tests pass should a separate production rollout be considered; Preview keys do not become available in Production automatically.

Vercel's free API deployment quota can return HTTP 402 (\`api-deployments-free-per-day\`), preventing a new Preview deployment despite valid GitHub CI. This is an account-level deploy limit, not an application bug.

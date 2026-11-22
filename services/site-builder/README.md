# MalGuard AI site builder

The public studio lives at `/ai/`. Existing chat, media and local-model tools are available at `/ai/classic.html`. The Vercel functions build static sites, answer coding and data questions, serve time-limited previews and package the approved source as ZIP.

The server verifies existing MalGuard sessions and calls `cf_gptoss120` through `models.malguard.site`. The current gateway output budget favors compact single-page sites. Chat and build prompts receive relevant excerpts from the public site index. When web search is allowed, GPT-OSS decides whether to search and chooses the query. The existing model gateway executes that query through Tavily and returns sources with the answer. Refresh the public site index with `python3 services/site-builder/knowledge/refresh.py`.

## Vercel settings

- Connect a dedicated **private** Vercel Blob store as `BLOB_READ_WRITE_TOKEN`, or set the server-only Upstash URL and token as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Set `APP_HOST` to the canonical app hostname. The Vercel system-provided preview hostname and production project URL are also accepted.
- For isolated staging, set `PREVIEW_ON_APP=1`. The generated HTML is served with a sandbox, a restrictive content security policy and no shared cache. Use this setting to verify the full flow before enabling branded domains.
- For branded production links, unset `PREVIEW_ON_APP`, attach a verified wildcard domain to the Vercel preview ingress, and configure its DNS and TLS. The default suffix is `malguard.site`. Preview hosts use a generated topic and random suffix. Preserve explicitly configured DNS hosts when validating the wildcard. A deployment without this routing can use `PREVIEW_HOST` if a separate verified hostname routes preview requests to the same storage.
- `PRO_ACCOUNT_HASHES` optionally holds comma-separated SHA-256 hashes of normalized emails from verified MalGuard accounts. Build defaults are 3/day Free and 25/day Pro, with a 100/day global cap. Set `DAILY_FREE_BUILDS`, `DAILY_PRO_BUILDS` and `DAILY_GLOBAL_BUILDS` to adjust them. Chat equivalents use the suffix `CHATS`. Checkout and automatic subscription provisioning require a billing integration.

Preview access ends 20 minutes after storage or immediately after acceptance. The owner may retry ZIP delivery through the original deadline. Redis expires the record automatically. Blob checks the same deadline at read time, disables CDN reads and sets a one-day storage deletion policy. Never expose the private store token to the browser.

Run `npm --prefix services/site-builder test` from the repository root to verify storage state transitions, ZIP delivery, source retrieval and CSV summaries.

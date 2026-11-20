# MalGuard for ChatGPT — MCP preview (not published)

Read-only Model Context Protocol integration with one tool: `check_public_link`.
The scanner runs in-process via `services/game-scam-guard/server/scanner.js` with guarded network access, no JavaScript execution, no downloads, no report-session retention, and no third-party reputation queries.

## Local setup

Requires Node.js >=22.6.0. From the repository root: `npm ci`.
Then run:

```sh
cd integrations/chatgpt-app
npm install
npm test
npm start
```

The local endpoint is `http://localhost:8787/mcp`; `GET /health` is provided for health checks.
Use MCP Inspector for local testing. To connect from ChatGPT, use a secure HTTPS tunnel for a private development setup and Plugins > Add custom MCP server.

## Important limitations

- Not deployed or published, and not a bypass for publisher identity verification.
- The in-memory rate limiter is for private preview only. Production needs distributed limits, monitoring, privacy disclosure, terms, support and abuse prevention.
- Submission requires verified OpenAI Platform publisher identity, public HTTPS /mcp endpoint, portal domain challenge, accurate metadata, five positive and three negative reviewer tests, and OpenAI review.
- Never submit private or token-bearing URLs. No scan can certify safety.
- The status `limited` does not mean safe; `unavailable` is inconclusive.
- This initial release has no embedded UI; an optional branded UI can be added after tool testing.

For the full tested preview and the initial unit tests, see the associated local build archive.

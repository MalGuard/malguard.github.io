import { handle } from "./agent.js";

export function endpoint(action) {
  return async function handler(request, result) {
    const stream = ["build", "chat"].includes(action)
      && request.headers.accept === "application/x-ndjson";
    const emit = event => {
      if (!result.headersSent) {
        result.statusCode = 200;
        result.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        result.setHeader("Cache-Control", "private, no-store, no-transform");
        result.setHeader("X-Content-Type-Options", "nosniff");
      }
      result.write(JSON.stringify(event) + "\n");
    };
    try {
      const host = request.headers.host;
      const url = new URL(request.url, "https://" + host);
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      const init = { method: request.method, headers };
      if (request.method !== "GET" && request.method !== "HEAD") {
        const raw = request.body;
        if (raw !== undefined) init.body = typeof raw === "string" || Buffer.isBuffer(raw) ? raw : JSON.stringify(raw);
        else { init.body = request; init.duplex = "half"; }
      }
      const reply = await handle(new Request(url, init), process.env, action, undefined,
        stream ? (stage, detail) => emit({ type: "progress", stage, detail }) : undefined);
      if (stream) {
        emit({ type: "result", status: reply.status, data: await reply.json() });
        result.end();
        return;
      }
      result.statusCode = reply.status;
      for (const [name,value] of reply.headers) result.setHeader(name,value);
      result.end(Buffer.from(await reply.arrayBuffer()));
    } catch {
      if (stream) {
        emit({ type: "result", status: 503, data: {error:"The agent service is temporarily unavailable."} });
        result.end();
        return;
      }
      result.statusCode = 503;
      result.setHeader("Cache-Control","no-store");
      result.setHeader("Content-Type","application/json");
      result.end(JSON.stringify({error:"The agent service is temporarily unavailable."}));
    }
  };
}

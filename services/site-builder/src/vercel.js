import { handle } from "./agent.js";

export function endpoint(action) {
  return async function handler(request, result) {
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
      const reply = await handle(new Request(url, init), process.env, action);
      result.statusCode = reply.status;
      for (const [name,value] of reply.headers) result.setHeader(name,value);
      result.end(Buffer.from(await reply.arrayBuffer()));
    } catch {
      result.statusCode = 503;
      result.setHeader("Cache-Control","no-store");
      result.setHeader("Content-Type","application/json");
      result.end(JSON.stringify({error:"The agent service is temporarily unavailable."}));
    }
  };
}

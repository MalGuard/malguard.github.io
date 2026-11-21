// Cloudflare Pages API status. This is intentionally a fail-closed readiness probe.
// It does not turn on ticket writes or expose project/environment configuration.
const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};
export async function onRequestGet() {
  return new Response(JSON.stringify({
    enabled: false,
    phase: 'cloudflare-pages-pending-backend',
    reason: 'support_backend_not_connected',
    attachmentsEnabled: false,
    aiEnabled: false,
    adminEnabled: false,
    turnstileSiteKey: null
  }), { status: 200, headers });
}

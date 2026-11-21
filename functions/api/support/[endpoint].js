// Cloudflare Pages support operations must not silently fall through to static files.
// Until a verified server-side datastore, identity provider and mailer exist, deny all writes.
const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};
export async function onRequest() {
  return new Response(JSON.stringify({
    error: 'support_backend_not_connected',
    enabled: false
  }), { status: 503, headers });
}

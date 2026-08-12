export function onRequestGet({ env }) {
  return Response.json({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

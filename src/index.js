// YOU ARE AN IDIOT — served from a single Cloudflare Worker.
//
// Serves the prank out of ./public via Workers Static Assets:
//   * index.html  — a fake "domain seized by the FBI" interstitial that, on
//                   click, detonates into the real youareanidiot.cc experience
//                   (2-frame dancing SVG + the real song + bouncing popups).
//   * media/youare.mp3, favicon.ico — static assets.
//
// Dynamic bits handled by the Worker:
//   * GET /whoami  — returns the visitor's real IP + geo (from Cloudflare) so
//                    the seizure page can show "we're tracking you" details.
//   * any unknown HTML route -> the main page, so stray links still work.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/whoami') {
      const cf = request.cf || {};
      const data = {
        ip:
          request.headers.get('CF-Connecting-IP') ||
          request.headers.get('x-real-ip') ||
          (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
          'unknown',
        city: cf.city || '',
        region: cf.region || '',
        country: cf.country || '',
        isp: cf.asOrganization || '',
        postal: cf.postalCode || '',
      };
      return new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    const res = await env.ASSETS.fetch(request);

    // Unknown route? If a browser is asking for a page, give it the main page so
    // stray links/typos still land on the experience.
    if (res.status === 404) {
      const accept = request.headers.get('accept') || '';
      if (accept.includes('text/html')) {
        return env.ASSETS.fetch(new URL('/', request.url));
      }
    }
    return res;
  },
};

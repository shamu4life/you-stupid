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

    let res = await env.ASSETS.fetch(request);

    // Unknown route? If a browser is asking for a page, give it the main page so
    // stray links/typos still land on the experience.
    if (res.status === 404) {
      const accept = request.headers.get('accept') || '';
      if (accept.includes('text/html')) {
        res = await env.ASSETS.fetch(new URL('/', request.url));
      }
    }

    // The unfurl card carries root-relative URLs; rewrite them to absolute using
    // the host that was actually requested, so it works on workers.dev or any
    // custom domain without hardcoding one.
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      return new HTMLRewriter()
        .on('meta', new AbsoluteUrls(url.origin))
        .transform(res);
    }
    return res;
  },
};

// Prefix root-relative og:/twitter: URL values with the request origin.
class AbsoluteUrls {
  constructor(origin) { this.origin = origin; }
  element(el) {
    const key = el.getAttribute('property') || el.getAttribute('name') || '';
    if (key === 'og:url') {
      el.setAttribute('content', this.origin + '/');
    } else if (key === 'og:image' || key === 'og:image:secure_url' || key === 'twitter:image') {
      const c = el.getAttribute('content') || '';
      if (c.startsWith('/')) el.setAttribute('content', this.origin + c);
    }
  }
}

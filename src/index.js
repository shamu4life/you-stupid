// YOU ARE AN IDIOT — served from a single Cloudflare Worker.
//
// Serves the prank out of ./public via Workers Static Assets. There are two
// front doors, chosen by hostname:
//   * the plain/apex domain (e.g. uwutoowo.com) -> index.html, a pixel clone of
//     the youtooz "UwosLab: The Grillerrr Plush" product page. Its countdown is
//     frozen at zero and "Add to cart" detonates straight into the real
//     youareanidiot.cc experience (flashing figure + voices + bouncing popups).
//   * the "casino" subdomain (e.g. casino.uwutoowo.com) -> seized.html, the fake
//     "domain seized by the FBI" interstitial that detonates on any gesture, and
//     whose link-unfurl card is the CasinoUwO crypto-casino promo.
//
// Dynamic bits handled by the Worker:
//   * GET /whoami  — returns the visitor's real IP + geo (from Cloudflare) so
//                    the seizure page can show "we're tracking you" details.
//   * host routing — the casino subdomain's root serves seized.html.
//   * any unknown HTML route -> that host's front door, so stray links still work.
//   * og:/twitter: meta URLs are rewritten to absolute per-host so the unfurl
//     card resolves on *.workers.dev or any custom domain without hardcoding one.

// A request is on the "casino" front door when its first hostname label is
// "casino" (casino.uwutoowo.com, casino.you-stupid.workers.dev, ...).
function isCasinoHost(hostname) {
  return (hostname || '').split('.')[0].toLowerCase() === 'casino';
}

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

    // Which front door does this host get for the root / unknown-HTML routes?
    const casino = isCasinoHost(url.hostname);
    const frontDoor = casino ? '/seized.html' : '/';

    // Root of the casino subdomain serves the seizure page instead of the clone.
    let res;
    if (casino && url.pathname === '/') {
      res = await env.ASSETS.fetch(new URL('/seized.html', request.url));
    } else {
      res = await env.ASSETS.fetch(request);
    }

    // Unknown route? If a browser is asking for a page, give it this host's front
    // door so stray links/typos still land on the experience.
    if (res.status === 404) {
      const accept = request.headers.get('accept') || '';
      if (accept.includes('text/html')) {
        res = await env.ASSETS.fetch(new URL(frontDoor, request.url));
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

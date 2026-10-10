// YOU ARE AN IDIOT — served from a single Cloudflare Worker.
//
// Three host-routed front doors, plus a time-gated apex cutover:
//   * casino subhost (e.g. casino.uwutoowo.com) -> public/seized.html, the fake
//     "domain seized by the FBI" interstitial (unfurls as the CasinoUwO card).
//     Always served; never redirected, never time-gated.
//   * milf host (sorryifuckedyour.mom) -> public/milf.html, a fake dating-site
//     landing page whose CTAs detonate into the idiot engine. Always served;
//     never redirected, never time-gated.
//   * plain / apex host (e.g. uwutoowo.com):
//       - BEFORE the cutover moment -> 302 to the real youtooz product page. This
//         mirrors the Cloudflare Redirect Rule that used to sit in front of the
//         apex, so the rule can be deleted and the Worker carries the redirect
//         for the remaining minutes of the drop.
//       - AT / AFTER the cutover moment -> public/index.html, the youtooz
//         product-page clone whose "Add to cart" detonates into the idiot engine.
//     The flip is automatic; nobody has to touch anything at cutover time.
//
// Dynamic bits:
//   * automatic apex cutover — Date.now() vs CUTOVER (drop close + 1s).
//   * GET /whoami — visitor IP + geo from CF headers (used by multiple pages).
//   * host routing + unknown-HTML fallback to the host's front door.
//   * per-host og:/twitter: unfurl-meta absolutization via HTMLRewriter.

const YOUTOOZ_PRODUCT_URL = 'https://youtooz.com/products/uwoslab-the-grillerrr-plush-9-inch';

// The youtooz drop closes 2026-07-19T19:00:00Z (12:00 PT). One second later the
// apex stops redirecting and starts serving the troll clone. Override without a
// code change by setting a CUTOVER_ISO var on the Worker (takes effect with no
// redeploy); this literal is the fallback.
const DEFAULT_CUTOVER_ISO = '2026-07-19T19:00:01Z';

// A request is on the "casino" front door when its first hostname label is
// "casino" (casino.uwutoowo.com, casino.you-stupid.workers.dev, ...).
function isCasinoHost(hostname) {
  return (hostname || '').split('.')[0].toLowerCase() === 'casino';
}

// A request is on the "milf" front door when the hostname is
// sorryifuckedyour.mom (or any subdomain thereof on *.workers.dev for testing).
function isMilfHost(hostname) {
  const h = (hostname || '').toLowerCase();
  return h === 'sorryifuckedyour.mom' || h.endsWith('.sorryifuckedyour.mom') ||
    h.split('.')[0] === 'milf';   // milf.you-stupid.workers.dev for testing
}

function cutoverMs(env) {
  const t = Date.parse((env && env.CUTOVER_ISO) || DEFAULT_CUTOVER_ISO);
  return Number.isNaN(t) ? Date.parse(DEFAULT_CUTOVER_ISO) : t;
}

// Should the apex serve the troll clone (true) or still redirect to youtooz
// (false)? Time-driven, with an explicit override for testing either state
// before the real cutover: `?preview=troll` or `?preview=redirect`.
function apexServesTroll(url, env) {
  const p = url.searchParams.get('preview');
  if (p === 'troll') return true;
  if (p === 'redirect') return false;
  return Date.now() >= cutoverMs(env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const casino = isCasinoHost(url.hostname);
    const milf = !casino && isMilfHost(url.hostname);

    // Apex/base host, before cutover: 302 to the youtooz product — exactly what
    // the (now-deletable) Redirect Rule did. 302 + no-store so browsers never
    // cache the redirect past the cutover moment. The casino and milf hosts are
    // exempt (they're always served, never redirected).
    if (!casino && !milf && !apexServesTroll(url, env)) {
      return new Response(null, {
        status: 302,
        headers: { location: YOUTOOZ_PRODUCT_URL, 'cache-control': 'no-store' },
      });
    }

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

    // Default /favicon.ico is the "uwoChud" emote — which leaks the gag in the
    // browser tab before anyone even clicks. Serve a host-appropriate icon
    // instead: the youtooz logo on the clone, the FBI seal on the seizure page,
    // a kiss-mark SVG on the milf page. (Detonation swaps to the emote via JS.)
    if (url.pathname === '/favicon.ico') {
      if (milf) {
        // Inline SVG kiss-mark emoji favicon for the dating site
        const kissSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💋</text></svg>`;
        return new Response(kissSvg, {
          headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' },
        });
      }
      const icon = casino ? '/images/FBI_SEAL.png' : '/images/youtooz-logo.svg';
      const r = await env.ASSETS.fetch(new URL(icon, request.url));
      return new Response(r.body, {
        status: r.status,
        headers: {
          'content-type': r.headers.get('content-type') || 'image/svg+xml',
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    // Which front door does this host get for the root / unknown-HTML routes?
    const frontDoor = casino ? '/seized.html' : milf ? '/milf.html' : '/';

    // Root of the casino subhost serves the seizure page; root of the milf host
    // serves the dating page; everything else gets the clone/default.
    let res;
    if (casino && url.pathname === '/') {
      res = await env.ASSETS.fetch(new URL('/seized.html', request.url));
    } else if (milf && url.pathname === '/') {
      res = await env.ASSETS.fetch(new URL('/milf.html', request.url));
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

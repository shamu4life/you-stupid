// YOU ARE AN IDIOT — served from a single Cloudflare Worker.
//
// Four host-routed front doors, plus a time-gated apex cutover:
//   * casino subhost (e.g. casino.uwutoowo.com) -> public/seized.html, the fake
//     "domain seized by the FBI" interstitial (unfurls as the CasinoUwO card).
//     Always served; never redirected, never time-gated.
//   * milf host (sorryifuckedyour.mom) -> public/milf.html, a fake dating-site
//     landing page whose CTAs detonate into the idiot engine. Always served;
//     never redirected, never time-gated.
//   * singles host (hotsinglesnear.you) -> public/singles.html, a "hot singles
//     in your area" dating page with a 3-step quiz; every link/button detonates.
//     Always served; never redirected, never time-gated.
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

// A request is on the "singles" front door when the hostname is
// hotsinglesnear.you (or a subdomain), or its first label is "singles".
function isSinglesHost(hostname) {
  const h = (hostname || '').toLowerCase();
  return h === 'hotsinglesnear.you' || h.endsWith('.hotsinglesnear.you') ||
    h.split('.')[0] === 'singles';   // singles.you-stupid.workers.dev for testing
}

// Heart-in-a-map-pin mark, same as the singles page logo.
const SINGLES_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF2D55"/><stop offset="1" stop-color="#FF7A3D"/></linearGradient></defs><path fill="url(#g)" d="M16 1.6c-6.3 0-11.4 5-11.4 11.2 0 8.2 11.4 17.6 11.4 17.6s11.4-9.4 11.4-17.6C27.4 6.6 22.3 1.6 16 1.6z"/><path fill="#fff" transform="translate(10 6.9) scale(.5)" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

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

// ?preview=milf / ?preview=singles / ?preview=casino force host routing on any
// hostname (for testing on workers.dev previews that lack wildcard DNS).
function previewHost(url) {
  return (url.searchParams.get('preview') || '').toLowerCase();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ph = previewHost(url);
    const casino = ph === 'casino' || isCasinoHost(url.hostname);
    const milf = !casino && (ph === 'milf' || isMilfHost(url.hostname));
    const singles = !casino && !milf && (ph === 'singles' || isSinglesHost(url.hostname));

    // Apex/base host, before cutover: 302 to the youtooz product — exactly what
    // the (now-deletable) Redirect Rule did. 302 + no-store so browsers never
    // cache the redirect past the cutover moment. The casino, milf and singles
    // hosts are exempt (they're always served, never redirected).
    if (!casino && !milf && !singles && !apexServesTroll(url, env)) {
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
    // a kiss-mark SVG on the milf page, the heart-pin on the singles page.
    // (Detonation swaps to the emote via JS.)
    if (url.pathname === '/favicon.ico') {
      if (singles) {
        return new Response(SINGLES_FAVICON, {
          headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' },
        });
      }
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
    const frontDoor = casino ? '/seized.html' : milf ? '/milf.html' : singles ? '/singles.html' : '/';

    // Root of the casino subhost serves the seizure page; root of the milf and
    // singles hosts serve their dating pages; everything else gets the clone.
    let res;
    if (frontDoor !== '/' && url.pathname === '/') {
      res = await env.ASSETS.fetch(new URL(frontDoor, request.url));
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

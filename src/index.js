// YOU ARE AN IDIOT — served from a single Cloudflare Worker.
//
// This serves a faithful copy of the real youareanidiot.cc (the HTML5 port:
// the genuine 2-frame dancing SVG, the real 320kbps "you are an idiot" song,
// and the original click->popup "procreate" + window-bouncing behavior) out of
// ./public via Workers Static Assets, plus two additions wired in on the
// client: auto-fullscreen and audio-on-first-gesture (see scripts/fullscreen.js).
//
// The Worker itself just routes:
//   * real files (page, css, js, mp3, icons) -> served from static assets
//   * any other path                         -> the idiot page, so popups and
//                                               stray links keep the chaos going

export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);

    // Unknown route? If a browser is asking for a page, give it the idiot page
    // (the popups open /lol.html, but this keeps any path working too).
    if (res.status === 404) {
      const accept = request.headers.get('accept') || '';
      if (accept.includes('text/html')) {
        return env.ASSETS.fetch(new URL('/lol.html', request.url));
      }
    }
    return res;
  },
};

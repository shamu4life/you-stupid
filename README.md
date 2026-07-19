<div align="center">

<img src=".github/social-preview.svg#gh-dark-mode-only"       alt="YOU ARE AN IDIOT — inspired by youareanidiot.cc, on a Cloudflare Worker" width="820">
<img src=".github/social-preview-light.svg#gh-light-mode-only" alt="YOU ARE AN IDIOT — inspired by youareanidiot.cc, on a Cloudflare Worker" width="820">

[![Cloudflare Workers](https://img.shields.io/badge/Deployed_on-Cloudflare_Workers-f38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-22c55e.svg)]()
[![Maturity](https://img.shields.io/badge/maturity-deeply_unserious-ff2d2d.svg)]()

</div>

<p align="center"><strong>Inspired by the infamous <a href="https://en.wikipedia.org/wiki/You_Are_an_Idiot">YouAreAnIdiot.org</a> JS trojan — behind two different disguises — on a single Cloudflare Worker.</strong></p>

The same chaos engine now sits behind **two host-routed front doors**:

- **The plain domain** opens as a pixel clone of a real **youtooz plush product page** ("UwosLab: The Grillerrr Plush"), price and description and all. The drop countdown is frozen at `00 : 00 : 00 : 00`, and the moment the mark clicks **Add to cart** it detonates *in place* — a flashing figure takes over, custom voice clips loop and stack, and a swarm of self-spawning popup windows bounces around. Shared as a link, it unfurls as the genuine-looking product card, so nothing gives it away. **Until the real drop closes it just 302-redirects to the genuine youtooz product; at a configured cutover instant the Worker automatically flips to serving the clone** — no redeploy, no hand on the switch.
- **The `casino.` subdomain** opens as the original convincing **"This Website Has Been Seized"** notice — FBI/DOJ seals, the visitor's **real IP, location, and ISP** under an "all connecting IP addresses are tracked" warning — and detonates on *any* gesture. Shared as a link, it unfurls as a flashy **crypto-casino promo card**.

> ⚠️ This is an obnoxious prank toy. Deploy it somewhere you're allowed to, and point it only at people who'll forgive you.

---

## What happens

### The plain domain — the plush store

0. **The cutover.** Before the drop's cutover instant the Worker 302-redirects the plain domain straight to the real youtooz product page — so while the genuine drop is live, the domain behaves exactly as it always did. At the cutover moment (`Date.now() ≥ CUTOVER`) it stops redirecting and starts serving the clone below. The flip is automatic and needs no deploy; a `no-store` header keeps the redirect from caching past it.
1. **The bait.** A faithful clone of the youtooz product page: real gallery images, `$29.99 USD`, the actual product blurb, a "Pre-order" line — and a drop countdown **frozen at zero**. Thumbnails swap the hero image and the quantity stepper works, so it behaves like the real store. No sound, nothing leaks.
2. **The detonation.** Clicking **Add to cart** flips the tab title to **YOU ARE AN IDIOT!**, swaps the favicon, kicks in the voice clips, and drops the flashing black-and-white figure over the whole page — using that click as the gesture, so audio and popups fire immediately.
3. **The chaos.** Popup windows bounce erratically around the screen; each one is its own copy of the page (storefront stripped to just the flashing figure). Interacting with any of them spawns more and stacks another out-of-phase copy of the audio, building into a proper wall of noise.

### The `casino.` subdomain — the seizure page

1. **The bait.** A serious-looking federal seizure page (real seals over a dark backdrop) reads back the visitor's actual `IP · city, region, country · ISP` — pulled live from Cloudflare — with a blinking "connection logged & monitored" line. It behaves like a normal page.
2. **The detonation.** *Any* gesture — click **Return to Safety**, tap, or press any key — flips to **YOU ARE AN IDIOT!** and the same chaos engine takes over.

---

## Caveats

A.k.a. things browsers no longer let a prank do — none of these are bugs, they're the modern web:

- **Nothing starts with zero interaction.** Sound legally requires a user gesture, so everything waits for the first one — but *any* gesture counts: a click, a tap, or a single keypress (even Alt to alt-tab away). A pure glance-and-close-the-tab escapes, and there's no way around that.
- **The pop-up blocker caps the swarm.** Chrome/Edge open ~1 popup per click unless the visitor allows pop-ups for the site; Firefox opens several. The code asks for more — the browser decides.
- **Audio lives in the windows you've clicked.** A freshly-spawned pop-up can't autoplay, so each window starts its own voice only once *it* is clicked.
- **The close prompt is generic.** Browsers hardcode the "Leave site?" text and ignore custom messages, so it can't say "Are you an idiot?".

---

## How it works

<details>
<summary><strong>Architecture</strong></summary>

It's a [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) site with a Worker in front of *every* request (`assets.run_worker_first`):

- **Host routing** — the Worker picks a front door by hostname: the `casino.` subdomain's root serves `public/seized.html` (the FBI page); every other host serves `public/index.html` (the youtooz clone). Unknown HTML routes fall back to that host's front door so stray links still land on the gag.
- **Timed apex cutover** — for every non-`casino.` host, `apexServesTroll()` compares `Date.now()` against a cutover time (`CUTOVER_ISO` var, else the baked-in default). *Before* it, the Worker returns a `302` to the youtooz product URL (`Cache-Control: no-store` so it never sticks past cutover) — this replaces a standalone Cloudflare Redirect Rule, so the Worker owns the whole apex. *After* it, the same host serves the clone. `?preview=troll` / `?preview=redirect` force either state for testing. The `casino.` subdomain is exempt — never redirected, never time-gated.
- **`GET /whoami`** — the Worker reads `CF-Connecting-IP` and `request.cf` (city/region/country/ISP) and returns them as JSON. This is the only dynamic endpoint; it's what makes the seizure page's "we're tracking you" details real.
- **The link-preview rewrite** — for HTML pages, the Worker runs an `HTMLRewriter` pass that turns each page's root-relative `og:`/`twitter:` image and URL meta into absolute ones using the host that was actually requested, so the unfurl works on `*.workers.dev` or any custom domain with nothing hardcoded.
- **Everything else** is served from `public/` via the `ASSETS` binding.

The clone (`index.html`) hides the idiot layer under a normal-looking storefront and detonates on **Add to cart**; the seizure page (`seized.html`) hides it under the `#seized` overlay and detonates on the first gesture. Both swap the title/favicon and share the same audio/popup engine.

**Wiring the domains.** Point both the apex (`uwutoowo.com`, a Worker route or custom domain) and the `casino.` subdomain at the Worker. Because the Worker itself does the pre-cutover redirect, you can **delete any standalone Cloudflare Redirect Rule** that used to send the apex to youtooz — the Worker carries it until the cutover instant, then flips to the clone on its own. To adjust the flip time without a redeploy, set a `CUTOVER_ISO` var on the Worker; to roll back after cutover, re-add the redirect rule (rules run before Workers, so it wins instantly).

</details>

<details>
<summary><strong>The interesting bits</strong></summary>

- **Random, stacking audio (Web Audio).** Two custom voice clips are decoded separately and silence-trimmed. Each repeat picks one at random (coin flip — so the same clip can play twice in a row). Each click stacks another voice through a limiter, with staggered start times so they build into a cacophony rather than doubling in unison.
- **CSS flash figure.** The "you are an idiot" text and emote images sit inside a `filter:invert()` animation toggling at ~1.5fps via `step-end` keyframes — the same black-and-white strobing effect as the original, no SVG frames needed.
- **Bouncing popups.** Script-opened windows are moved with `window.moveTo` on a random walk (both axes), bouncing off the current screen's bounds (`availLeft`/`availTop`), so it behaves on multi-monitor desktops.
- **It doesn't leak.** Audio, the close-nag, the right-click block, and the anti-`Alt+F4` alert are all gated until *after* the reveal — until then, the seizure page is completely deadpan.

</details>

---

## Run it locally

Requires [Node.js](https://nodejs.org/) (v18+). The only dependency is Wrangler (dev-only).

```bash
npm install
npm run dev        # local Worker at http://localhost:8787
```

## Deploy

```bash
npx wrangler login   # one-time
npm run deploy       # ship it to Cloudflare
```

This repo is wired to Cloudflare's Git integration, so pushes deploy automatically. The Worker name comes from `wrangler.toml` (`you-stupid`).

> **Want strangers to actually see it — and the link to unfurl?** A `*.workers.dev` URL behind **Cloudflare Access** (a login wall) returns a redirect to the Access login for *every* request, including link-preview crawlers (Discord, X, Slack, Facebook) — so the card never renders and the FB Sharing Debugger reports a 403. Remove the Access app under **Zero Trust → Access → Applications** (or **Workers & Pages → you-stupid → Settings → Domains & Routes**), or attach a custom domain, then re-scrape.

---

## Project layout

```
src/index.js              Worker: host-routes the two front doors, GET /whoami (visitor IP + geo)
wrangler.toml             Cloudflare Workers (static assets) config
public/
  index.html              apex front door: youtooz product-page clone + idiot engine (Add to cart detonates)
  seized.html             casino.* front door: FBI seizure page + idiot engine (any gesture detonates)
  media/voice1.mp3        custom voice clip 1
  media/voice2.mp3        custom voice clip 2
  images/                 emote.png; uwo1-5.png + uwo_og.png (clone product + card); FBI_SEAL/DOJ_SEAL/background/og.png (seizure page + casino card)
  favicon.ico             the emote (swapped in on detonation)
.github/
  social-preview.svg      README header cards (dark) ...
  social-preview-light.svg ... and light
```

No bundler, no build step, no `node_modules` folder silently judging you.

---

## License &amp; assets

The original code here is free to use however you want. The **bundled assets are not mine to license**: the FBI/DOJ seals and the "seized" background belong to their respective owners and are included purely for parody. This is a joke; treat it like one.

---

## Credits

Built by **Claude** (Anthropic). The original [YouAreAnIdiot.org](https://en.wikipedia.org/wiki/You_Are_an_Idiot) JS trojan is the work of unknown internet history; [youareanidiot.cc](https://youareanidiot.cc) is the official HTML5 port by [Endermanch](https://github.com/Endermanch).

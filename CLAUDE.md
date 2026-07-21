# you-stupid

A Cloudflare Worker prank with **two host-routed front doors**, both feeding the same youareanidiot.cc-inspired chaos engine:

- **Plain / apex host** (e.g. `uwutoowo.com`) → `public/index.html`, a clone of the youtooz **"UwosLab: The Grillerrr Plush (9in)"** product page. The drop countdown is frozen at zero; clicking **Add to cart** detonates straight into the idiot engine *in place* (so the click gesture powers the audio + popups). **Time-gated:** *before* the cutover instant the apex 302-redirects to the real youtooz product (mirroring the old Cloudflare Redirect Rule so it can be deleted); *at/after* cutover it serves the clone. The flip is automatic.
- **`casino.` subhost** (e.g. `casino.uwutoowo.com`) → `public/seized.html`, the fake "FBI domain seized" interstitial that detonates on any gesture, and whose unfurl card is the CasinoUwO crypto-casino promo. Never redirected or time-gated.

## Architecture

- `src/index.js` — Worker in front of every request (`assets.run_worker_first` in `wrangler.toml`). Serves `public/` via `env.ASSETS`. Host routing: `isCasinoHost()` (first hostname label === `casino`) sends the root of the casino subhost to `/seized.html`; every other host gets `/index.html` (the clone) at `/`. **Apex cutover:** `apexServesTroll()` returns `Date.now() >= cutoverMs(env)` — before that instant, any non-casino request gets a `302` to the youtooz product URL (`+ Cache-Control: no-store` so it never sticks in cache past cutover); after, it serves the clone. Cutover time is `DEFAULT_CUTOVER_ISO` (`2026-07-19T19:00:01Z`, the drop close + 1s), overridable at runtime with a `CUTOVER_ISO` Worker var (no redeploy). Test either state with `?preview=troll` / `?preview=redirect`. `GET /whoami` returns `{ip, city, region, country, isp, postal}` from `CF-Connecting-IP` + `request.cf`. Unknown HTML routes fall back to that host's front door. For HTML responses it runs an `HTMLRewriter` pass (`AbsoluteUrls`) that rewrites root-relative `og:`/`twitter:` image + URL meta to absolute using the requested host — so each page's link-preview card resolves on `*.workers.dev` or any custom domain without hardcoding one.
- `public/index.html` — a near-1:1 clone of the real youtooz **ProductModal** + embedded idiot engine. **Hand-authored** (not from the build script). Self-hosted **Luckiest Guy** (display) + **Inter** (body) + **Material Icons** (codepoint glyphs) from `public/fonts/`. Colors are the exact theme tokens: the per-product **env gradient `#4e549f → #d07260`** (title `to right`, countdown banner `225deg`, page backdrop) and the **"on-fire" pink `#FF467F → #FF4669`** (Add-to-cart, `Ships Worldwide` marquee, pre-order departure); body text `#232323`; flip-clock countdown cells `rgba(0,0,0,.5)`. Includes the 9" starburst badge, carousel arrows, spec table, and pre-order box. The countdown is **live** — starts at `00:00:01:30` (override with `?cd=<seconds>`) and ticks to zero, where `soldOut()` flips Add-to-cart to a muted **"Sold out"** + banner "This drop has ended", then ~1.2s later auto-reveals the flashing figure *silently* (`becomeIdiot()`, no audio/popups without a gesture); the first click after that erupts into the full chaos. **Any click detonates** (`detonate()` → in-place chaos) *except* clicks in the gallery (thumbnails + arrows just flip the picture). On first visit a Temu-style **"spin to win"** wheel (`#wheelOverlay`, inline SVG) covers the modal, spins to a random `% off` and "applies" it to the price on claim — shown once per session (`sessionStorage`), and gated (`wheelOpen` + `stopPropagation`) so it spins without detonating. Product data mirrors the real page.
- `public/seized.html` — the FBI-seized interstitial + full idiot engine (incl. the hidden "trace frame" easter-egg). This is the file the Python build script generates (was `public/index.html` before the two-door split).
- `public/media/voice1.mp3`, `voice2.mp3` — custom ElevenLabs voice clips. Silence-trimmed at build time by ffmpeg; runtime also trims via Web Audio. Used by both front doors.
- `public/images/emote.png` — custom Twitch emote (112×112) used everywhere the original had a smiley.
- `public/images/uwo1.png` … `uwo5.png` — the cloned product's gallery images (`uwo1` = main hero, rest = thumbnails), pulled from the youtooz Shopify CDN and downscaled. `uwo_og.png` — the clone's Open Graph card (1000×1000 plush shot). `youtooz-logo.svg` — the real youtooz logo mark (recolored to `#111`), used in the clone header/footer.
- `public/fonts/inter-var.woff2`, `luckiestguy.woff`, `material-icons.woff2` — the clone's self-hosted webfonts, mirrored from the real youtooz theme so nothing hotlinks a CDN. (`glyphset.bin` is the seized page's easter-egg payload, unrelated.)
- `public/images/FBI_SEAL.png`, `DOJ_SEAL.png`, `background.png` — seized-page assets.
- `public/images/og.png` — the CasinoUwO crypto-casino unfurl card, referenced by `seized.html`; shown when the casino subhost URL is shared, independent of the page that loads.
- `wrangler.toml` — Workers + Static Assets config. `assets.run_worker_first = true` so the Worker runs ahead of asset serving and can host-route + rewrite the unfurl meta. Worker name: `you-stupid`.

## Build

`public/seized.html` (the FBI/idiot page) is generated by a Python script, not edited directly:

```bash
python3 /tmp/.../scratchpad/build_seized.py /tmp/.../scratchpad/full/index.html
# writes public/seized.html
```

The script lives in the session scratchpad. If it's gone (new session), reconstruct it from the current `public/seized.html` — the HTML template is embedded verbatim in `TPL`. The script extracts two `<svg class="frame-black/white">` elements from the source HTML (vestigial; the build still expects them), inlines them as `__FRAME_BLACK__`/`__FRAME_WHITE__` placeholders, and writes the seized page.

`public/index.html` (the youtooz clone) is hand-authored — no build script.

After editing either page, always syntax-check the inline JS:

```bash
# extract inline JS and check (swap in index.html / seized.html)
python3 -c "import re; open('/tmp/_c.js','w').write('\n;\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', open('public/seized.html').read(), re.S))); print('ok')"
node --check /tmp/_c.js
```

## Audio engine

Two clips loaded as separate `AudioBuffer`s. On every repeat, each playing "voice" flips a coin to pick clip 0 or 1 — so order is random (can repeat). Each voice is a self-perpetuating `chain(when)` call: plays a clip, schedules `chain` on `onended` after a 100ms breath. Stacked voices start staggered by up to 1.5s so they build into cacophony. Fallback: the `<audio id="snd">` element if Web Audio is unavailable.

## Key behaviours

- **Seized page (`seized.html`) — any gesture detonates** — `pointerdown` or `keydown` on the overlay hides it, swaps title/favicon, starts 2 voices and 6 popups (desktop) or 6 in-page sprites + vibrate (mobile).
- **Clone (`index.html`) — only Add to cart detonates** — the storefront stays "real" (thumbnails swap the main image, quantity ±, links inert) until `Add to cart`, which calls `detonate()`: reveal the flashing figure over the page (`body{overflow:hidden}` + full-screen `.idiot.live`), swap title/favicon, 2 voices + 6 popups/sprites. After the reveal, any further `pointerdown`/`keydown` stacks 1 more voice + 6 more popups.
- **Popups open `/`** — so on the apex they reload the clone; its `isPopup` branch (`window.opener`) strips the storefront chrome, shows the flashing figure, and bounces the window via `window.moveTo`. Each popup click: 1 more voice + 3 more popups.
- **Mobile detection** — UA string `/Android|iPhone|iPad|iPod/i` or iPadOS (`platform==="MacIntel" && maxTouchPoints>1`). Mobile gets bouncing `<div>` sprites instead of `window.open`.
- **Gating** — right-click block and anti-Alt+F4 alert only activate after the reveal (`idiotMode`). `onbeforeunload` is ungated (generic browser dialog).

## Local dev

```bash
npm install
npm run dev   # http://localhost:8787
```

`/whoami` returns `{}` fields locally (no real CF headers). Test geo display manually against the deployed preview URL.

## Deploy

Cloudflare Git integration builds `main` on push. Manual deploy: `npm run deploy`. Preview URLs appear as PR comments from the Cloudflare bot. **Gotcha:** a `main` build can land as an uploaded *version* without being promoted to the live production deployment — if `you-stupid`'s `modified_on` / Deployments tab doesn't advance after a merge, promote it manually (Workers & Pages → you-stupid → Deployments) or `npm run deploy`. Verify a promotion by requesting a new-deploy-only asset on a wired domain (e.g. `https://casino.uwutoowo.com/images/uwo1.png` → 200).

## Domains

The apex (`uwutoowo.com`) and the `casino.` subdomain are both Worker routes/custom domains (managed in the dashboard; `wrangler.toml` `routes` stays commented out). The Worker handles the apex's pre-cutover redirect itself, so **no standalone Cloudflare Redirect Rule is needed** — deleting it hands the apex fully to the Worker. Re-adding such a rule is the instant rollback (rules run before Workers).

## Workflow

All changes go on a feature branch → PR → squash merge to `main`. The Cloudflare bot posts a deploy status comment on every PR; wait for ✅ before merging.

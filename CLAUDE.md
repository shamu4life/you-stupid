# you-stupid

A Cloudflare Worker prank with **four host-routed front doors**, all feeding the same youareanidiot.cc-inspired chaos engine:

- **Plain / apex host** (e.g. `uwutoowo.com`) → `public/index.html`, a clone of the youtooz **"UwosLab: The Grillerrr Plush (9in)"** product page. The drop countdown is frozen at zero; clicking **Add to cart** detonates straight into the idiot engine *in place* (so the click gesture powers the audio + popups). **Time-gated:** *before* the cutover instant the apex 302-redirects to the real youtooz product (mirroring the old Cloudflare Redirect Rule so it can be deleted); *at/after* cutover it serves the clone. The flip is automatic.
- **`casino.` subhost** (e.g. `casino.uwutoowo.com`) → `public/seized.html`, the fake "FBI domain seized" interstitial that detonates on any gesture, and whose unfurl card is the CasinoUwO crypto-casino promo. Never redirected or time-gated.
- **`sorryifuckedyour.mom`** → `public/milf.html`, "MatureMingle", a fake dating site for meeting women **45 and up — exclusively** (dark purple-pink theme). `/whoami` puts the visitor's city in the headline ("Mature. Confident. Near [City]."). A 3-step quiz and fake incoming-chat toasts build the bait; every other link/button detonates. Unfurl card is `milf_og.png`. Never redirected or time-gated.
- **`hotsinglesnear.you`** → `public/singles.html`, a general "hot singles in your area" dating site targeting **21–35 exclusively** (all genders, light red-orange theme, brand `hotsingles` + `near.you`). `/whoami` puts the visitor's city in the headline ("Hot singles in [City] want to meet you."). Same quiz + toast bait as MatureMingle; every other link/button detonates. Unfurl card is `singles_og.png`. Never redirected or time-gated.
- Both dating pages show **blurred AI-generated faces** of people who don't exist (see `public/images/people/`) — no real people, no explicit content.
- Both dating hosts **double as mbedfx embed domains** (the owner's separate `mbedfx` Worker): swap `x.com` in a post link for `hotsinglesnear.you` (or `sorryifuckedyour.mom`) and it unfurls in Discord as the real post. With `d.` in front (`d.hotsinglesnear.you/…`, `d.sorryifuckedyour.mom/…`) the same link answers with the post's media file instead of a card, as `d.mbedfx.app` does. The dating page at `/` and every file in `public/` are unaffected — see `askMbedfx()` below.

## Architecture

- `src/index.js` — Worker in front of every request (`assets.run_worker_first` in `wrangler.toml`). Serves `public/` via `env.ASSETS`. Host routing: `isCasinoHost()` (first hostname label === `casino`) sends the root of the casino subhost to `/seized.html`; `isMilfHost()` (hostname is `sorryifuckedyour.mom` or first label is `milf`) sends the root to `/milf.html`; `isSinglesHost()` (hostname is `hotsinglesnear.you` or first label is `singles`) sends the root to `/singles.html`; every other host gets `/index.html` (the clone) at `/`. **Apex cutover:** `apexServesTroll()` returns `Date.now() >= cutoverMs(env)` — before that instant, any request not on the casino/milf/singles hosts gets a `302` to the youtooz product URL (`+ Cache-Control: no-store` so it never sticks in cache past cutover); after, it serves the clone. Cutover time is `DEFAULT_CUTOVER_ISO` (`2026-07-19T19:00:01Z`, the drop close + 1s), overridable at runtime with a `CUTOVER_ISO` Worker var (no redeploy). Test either state with `?preview=troll` / `?preview=redirect`. **Host preview:** `?preview=milf`, `?preview=singles` or `?preview=casino` forces the corresponding front door on any hostname — useful on `*.workers.dev` preview deployments that lack wildcard DNS for the `milf.`/`singles.`/`casino.` subdomain prefixes. `GET /whoami` returns `{ip, city, region, country, isp, postal}` from `CF-Connecting-IP` + `request.cf`. **mbedfx hand-off:** on the milf/singles hosts only, a GET/HEAD whose path has no file in `public/` (ASSETS 404) is first offered to the `mbedfx` Worker via the `MBEDFX` service binding (`askMbedfx()`, same request and hostname). mbedfx answers only embed paths (post/profile links, share codes, `/_media/`, its activity + oEmbed callbacks) and marks them `x-mbedfx-guest: served`; those are returned **as-is** (no `AbsoluteUrls` rewrite, which would clobber their `og:url`). Anything unmarked — mbedfx declining `/robots.txt`, a bare `/typo`, its API; an error; a binding that's missing — is discarded and the request continues below exactly as before. The mbedfx side lives in `shamu4life/mbedfx` `src/guesthost.ts`. Unknown HTML routes fall back to that host's front door. For HTML responses it runs an `HTMLRewriter` pass (`AbsoluteUrls`) that rewrites root-relative `og:`/`twitter:` image + URL meta to absolute using the requested host — so each page's link-preview card resolves on `*.workers.dev` or any custom domain without hardcoding one.
- `public/index.html` — a near-1:1 clone of the real youtooz **ProductModal** + embedded idiot engine. **Hand-authored** (not from the build script). Self-hosted **Luckiest Guy** (display) + **Inter** (body) + **Material Icons** (codepoint glyphs) from `public/fonts/`. Colors are the exact theme tokens: the per-product **env gradient `#4e549f → #d07260`** (title `to right`, countdown banner `225deg`, page backdrop) and the **"on-fire" pink `#FF467F → #FF4669`** (Add-to-cart, `Ships Worldwide` marquee, pre-order departure); body text `#232323`; flip-clock countdown cells `rgba(0,0,0,.5)`. Includes the 9" starburst badge, carousel arrows, spec table, and pre-order box. The countdown is **live** — starts at `00:00:01:30` (override with `?cd=<seconds>`) and ticks to zero, where `soldOut()` flips Add-to-cart to a muted **"Sold out"** + banner "This drop has ended", then ~1.2s later auto-reveals the flashing figure *silently* (`becomeIdiot()`, no audio/popups without a gesture); the first click after that erupts into the full chaos. **Any click detonates** (`detonate()` → in-place chaos) *except* clicks in the gallery (thumbnails + arrows just flip the picture). On first visit a Temu-style **"spin to win"** wheel (`#wheelOverlay`, inline SVG) covers the modal, spins to a random `% off` and "applies" it to the price on claim — shown once per session (`sessionStorage`), and gated (`wheelOpen` + `stopPropagation`) so it spins without detonating. Product data mirrors the real page.
- `public/seized.html` — the FBI-seized interstitial + full idiot engine (incl. the hidden "trace frame" easter-egg). This is the file the Python build script generates (was `public/index.html` before the two-door split).
- `public/singles.html` and `public/milf.html` — the two dating pages + idiot engine. **Hand-authored**, and deliberately built from the same skeleton (live bar → sticky nav → hero + quiz card → "online near [City]" grid → info sections → testimonials → gradient CTA → footer, plus the toast), so a fix in one usually applies to the other. Shared mechanics:
  - Inter (self-hosted); icons are inline Material Icons SVG paths in a `<symbol>` sprite; the logo mark is also served as the host's favicon by the Worker.
  - Photos: one `.blob` rule paints `var(--img)` (a face from `public/images/people/`) over a `--b1/--b2` fallback gradient; palette classes `.p1`…`.p12` (profiles) and `.t1`…`.t3` (testimonials) set those vars. Cards blur it again with `blur(15px)`, avatars with `blur(1.5px)`.
  - `/whoami` fills `.city`/`.city-fill` and switches distances to km outside US/GB/LR/MM. Live counters drift every few seconds.
  - **Safe:** the quiz options + Back (`.opt`, `.back`) and the toast's `×` (`.toast-x`). **Detonates:** every other `a`, `button` or `[data-det]` (cards, nav, Join/Log in, See all, the "liked you" chip, quiz result "See my matches", toast body/Reply, final CTA, footer links).
  - Quiz: step 1 "I am a…" → step 2 filters the grid and the toast senders → step 3 → "searching" radar → "We found N … near [City]!".
  - Toasts (up to 3) slide in ~6.5s after load with a typing indicator, bump the Messages badge and prefix the tab title with "(n) New message"; dismissing one queues the next.
- `singles.html` specifics: light theme, "hot" gradient `#FF2D55 → #FF7A3D`, heart-in-a-map-pin logo. **Everyone shown is 21–35** (profiles 25–32, testimonials 29–31) and the footer gate says 21+. Step 2 is "Show me… Women/Men/Everyone" (`data-g="w|m|x"` on cards); step 3 (age 21–24/25–29/30–35/No preference) is flavor only. Faces `hs01`…`hs12`, `hst1`…`hst3`.
- `milf.html` specifics: dark theme (`--bg:#0F0A1A`, gradient `#7C3AED → #EC4899 → #F43F5E`), lips logo. **Every woman shown is 45+** (profiles 45–61, four per bracket; women's testimonials 54 and 58; the one younger testimonial is a man, the "cub"). Step 2 is "Show me women aged… 45–49/50–54/55+/Any" (`data-a="<age>"` on cards, `inRange()` in 5-year brackets); step 3 ("what are you looking for") is flavor only. Has a "Why MatureMingle?" feature grid where singles has "How it works". Faces `mm01`…`mm12`, `mmt1`…`mmt3`.
- `public/media/voice1.mp3`, `voice2.mp3` — custom ElevenLabs voice clips. Silence-trimmed at build time by ffmpeg; runtime also trims via Web Audio. Used by all four front doors.
- `public/images/emote.png` — custom Twitch emote (112×112) used everywhere the original had a smiley.
- `public/images/uwo1.png` … `uwo5.png` — the cloned product's gallery images (`uwo1` = main hero, rest = thumbnails), pulled from the youtooz Shopify CDN and downscaled. `uwo_og.png` — the clone's Open Graph card (1000×1000 plush shot). `youtooz-logo.svg` — the real youtooz logo mark (recolored to `#111`), used in the clone header/footer.
- `public/fonts/inter-var.woff2`, `luckiestguy.woff`, `material-icons.woff2` — the clone's self-hosted webfonts, mirrored from the real youtooz theme so nothing hotlinks a CDN. (`glyphset.bin` is the seized page's easter-egg payload, unrelated.)
- `public/images/FBI_SEAL.png`, `DOJ_SEAL.png`, `background.png` — seized-page assets.
- `public/images/og.png` — the CasinoUwO crypto-casino unfurl card, referenced by `seized.html`; shown when the casino subhost URL is shared, independent of the page that loads.
- `public/images/people/` — the dating pages' faces: `hs*` (hotsinglesnear.you) and `mm*` (MatureMingle), 40×50 JPEGs under 1 KB each, **already blurred**, so a sharp face never ships (opening one directly shows a smudge). They're StyleGAN3 faces of people who don't exist, from thispersonnotexist.org, whose terms allow personal and commercial use. Pipeline: `POST https://thispersonnotexist.org/load-faces` with `{"type":"F"|"M","age":"21-35"|"34-50"|"49-100","race":…,"emotion":"happy"}` → 8 ids → `GET /downloadimage/<id>` (1024² JPEG) → crop ~4:5 head-and-shoulders → resize to 40×50 (Lanczos) → GaussianBlur(0.9) → JPEG q82. **Only the adult age buckets are ever requested (never `1-21`), and every face is reviewed by eye at full size before use; anything that looks young is rejected.** The generator's filters are loose (a `21-35` request once returned a child's face, `M` returned a woman, and `34-50` mostly reads under 45), so the filters only narrow the pool and the eye check decides. Per site: MatureMingle faces must clearly read 45+ (in practice the `49-100` bucket, rejecting anything that could pass for early 40s); singles faces come from `21-35` and must clearly read as adults in that range.
- `public/images/milf_og.png`, `singles_og.png` — the dating unfurl cards (1200×630): logo, headline, a tilted blurred profile card and a chat bubble. Each is a small HTML page screenshotted with headless Chromium (Playwright), so it shares the page's Inter font, faces and CSS (Pillow can't draw color emoji — it once printed a tofu box for 💋). The templates live in the session scratchpad; if they're gone, rebuild one from the page's CSS.
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
- **Dating pages (`milf.html`, `singles.html`) — everything clickable detonates except the quiz and the toast's ×** — the quiz walks three steps → a "searching" radar → "We found N … near [City]!", whose **See my matches** button detonates. Scrolling and clicking plain text are harmless. Same reveal + chaos engine as the clone; after the reveal, any further `pointerdown`/`keydown` stacks more chaos.
- **Popups open `/`** — so on the apex they reload the clone; its `isPopup` branch (`window.opener`) strips the storefront chrome, shows the flashing figure, and bounces the window via `window.moveTo`. Each popup click: 1 more voice + 3 more popups.
- **Mobile detection** — UA string `/Android|iPhone|iPad|iPod/i` or iPadOS (`platform==="MacIntel" && maxTouchPoints>1`). Mobile gets bouncing `<div>` sprites instead of `window.open`.
- **Gating** — right-click block and anti-Alt+F4 alert only activate after the reveal (`idiotMode`). `onbeforeunload` is ungated (generic browser dialog).

## Local dev

```bash
npm install
npm run dev   # http://localhost:8787
```

`wrangler dev` fills `request.cf` from your real network location, so `/whoami` returns your own city locally. Add `?preview=singles` / `?preview=milf` / `?preview=casino` to see the other front doors on localhost.

## Deploy

Cloudflare Git integration builds `main` on push. Manual deploy: `npm run deploy`. Preview URLs appear as PR comments from the Cloudflare bot. **Gotcha:** a `main` build can land as an uploaded *version* without being promoted to the live production deployment — if `you-stupid`'s `modified_on` / Deployments tab doesn't advance after a merge, promote it manually (Workers & Pages → you-stupid → Deployments) or `npm run deploy`. Verify a promotion by requesting a new-deploy-only asset on a wired domain (e.g. `https://casino.uwutoowo.com/images/uwo1.png` → 200).

## Domains

The apex (`uwutoowo.com`), the `casino.` subdomain, `sorryifuckedyour.mom`, `hotsinglesnear.you`, and `d.sorryifuckedyour.mom` and `d.hotsinglesnear.you` (mbedfx's media-file prefix on the two embed domains) are all Worker custom domains declared in `wrangler.toml` (`[[routes]]` with `custom_domain = true`). Wrangler applies them on every deploy, so route config lives in code and survives dashboard resets. Treat that list as the complete set: a hostname attached only in the dashboard can be detached by the next deploy, so add new domains to `wrangler.toml` rather than the dashboard. The Worker handles the apex's pre-cutover redirect itself, so **no standalone Cloudflare Redirect Rule is needed** — deleting it hands the apex fully to the Worker. Re-adding such a rule is the instant rollback (rules run before Workers).

**The dating domains are shared, not handed over.** mbedfx serves embeds on them through this Worker's `MBEDFX` service binding, never through its own routes — a hostname can be a custom domain of only one Worker, and it stays this one. Their mail is a third, independent use: Cloudflare Email Routing on each zone sends it to the `throwaway-email` Worker (shitpost.email), which touches only MX/TXT records, never the HTTP side. The binding expects a Worker named `mbedfx` in the same Cloudflare account; at runtime, a missing or failing binding just means no embeds (`askMbedfx()` returns null). Embeds don't work on `*.workers.dev` previews (mbedfx only recognises the real dating hostnames, so it answers unmarked and the preview behaves as before).

To test a dating host on a preview deployment, add `?preview=milf` or `?preview=singles` to the preview URL. (The Worker also treats a first hostname label of `milf.`/`singles.` as a testing alias, but branch previews have no wildcard DNS, so the query param is the reliable route.)

## Workflow

All changes go on a feature branch → PR → squash merge to `main`. The Cloudflare bot posts a deploy status comment on every PR; wait for ✅ before merging.

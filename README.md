<div align="center">

<img src=".github/social-preview.svg#gh-dark-mode-only"       alt="YOU ARE AN IDIOT — a youareanidiot.cc recreation on a Cloudflare Worker" width="820">
<img src=".github/social-preview-light.svg#gh-light-mode-only" alt="YOU ARE AN IDIOT — a youareanidiot.cc recreation on a Cloudflare Worker" width="820">

[![Cloudflare Workers](https://img.shields.io/badge/Deployed_on-Cloudflare_Workers-f38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-22c55e.svg)]()
[![No build step](https://img.shields.io/badge/build-none-success.svg)]()
[![Static assets](https://img.shields.io/badge/served_from-Workers_Static_Assets-f38020.svg)](https://developers.cloudflare.com/workers/static-assets/)
[![Maturity](https://img.shields.io/badge/maturity-deeply_unserious-ff2d2d.svg)]()

</div>

<p align="center"><strong>A faithful recreation of the infamous <a href="https://en.wikipedia.org/wiki/You_Are_an_Idiot">youareanidiot.cc</a> prank — wrapped in a fake "FBI domain seized" page — on a single Cloudflare Worker.</strong></p>

It opens as a convincing **"This Website Has Been Seized"** notice, complete with the FBI/DOJ seals and the visitor's **real IP, location, and ISP** under a "all connecting IP addresses are tracked" warning. The instant they click **Return to Safety**, it detonates into the classic: dancing smiley, the real song looping, and a swarm of self-spawning popup windows.

> ⚠️ This is an obnoxious prank toy. Deploy it somewhere you're allowed to, and point it only at people who'll forgive you.

---

## What happens

1. **The bait.** A serious-looking federal seizure page (real seals over a dark backdrop) reads back the visitor's actual `IP · city, region, country · ISP` — pulled live from Cloudflare — with a blinking "connection logged & monitored" line, a timestamp, and a case number. It behaves like a normal page: no sound, no funny business, nothing leaks.
2. **The detonation.** Click **Return to Safety** (or anywhere): the tab title flips to **YOU ARE AN IDIOT!**, the favicon swaps from the FBI seal to a grinning smiley, the song kicks in, and the two-frame dancing figure takes over the screen.
3. **The chaos.** Every click spawns popup windows that bounce erratically around the screen; clicking *those* spawns more and stacks another out-of-phase copy of the song, building into a proper wall of noise.

---

## Caveats

A.k.a. things browsers no longer let a prank do — none of these are bugs, they're the modern web:

- **No zero-click autoplay or fullscreen.** Sound and fullscreen legally require a user gesture, so everything starts on that first click. (The original got away with it in the Flash era.)
- **The popup blocker caps the swarm.** Chrome/Edge open ~1 popup per click unless the visitor allows pop-ups for the site; Firefox opens several. The code asks for more — the browser decides.
- **Audio lives in the windows you've clicked.** A freshly-spawned popup can't autoplay, so each window starts its own voice only once *it* is clicked.
- **The close prompt is generic.** Browsers hardcode the "Leave site?" text and ignore custom messages, so it can't say "Are you an idiot?".

---

## How it works

<details>
<summary><strong>Architecture</strong></summary>

It's a [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) site with a thin Worker in front:

- **`GET /whoami`** — the Worker reads `CF-Connecting-IP` and `request.cf` (city/region/country/ISP) and returns them as JSON. This is the only dynamic endpoint; it's what makes the seizure page's "we're tracking you" details real.
- **Everything else** is served straight from `public/`. Unknown HTML routes fall back to the main page so stray links still land on the gag.

The whole experience is one `public/index.html`: a fixed `#seized` overlay (the seizure notice) sitting on top of the hidden idiot layer (the inlined two-frame dancing SVG). The first click hides the overlay, swaps the title/favicon, and "detonates."

</details>

<details>
<summary><strong>The interesting bits</strong></summary>

- **Gapless, stacking audio (Web Audio).** The clip is decoded once, its end-silence auto-trimmed, and looped sample-accurately (no dead air). Each click adds another voice at a random phase through a limiter, so windows pile into a cacophony — popups can't autoplay, so all the "extra windows" voices are produced from the windows that *can* play.
- **Bouncing popups.** Script-opened windows are moved with `window.moveTo` on a random-walk (both axes), bouncing off the current screen's bounds (`availLeft`/`availTop`, so it behaves on multi-monitor desktops).
- **It doesn't leak.** Audio, the close-nag, the right-click block, and the anti-`Alt+F4` alert are all gated until *after* the reveal — until then the seizure page is completely deadpan.

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

> **Want strangers to actually see it?** If your `*.workers.dev` URL is behind Cloudflare Access (a login wall), turn it off under **Workers & Pages → you-stupid → Settings → Domains & Routes**, or attach a custom domain.

---

## Project layout

```
src/index.js              Worker: serves ./public, plus GET /whoami (visitor IP + geo)
wrangler.toml             Cloudflare Workers (static assets) config
public/
  index.html              the whole show: seizure overlay + dancing SVG + the script
  media/youare.mp3        the real "you are an idiot" loop (320 kbps)
  images/                 FBI_SEAL.png, DOJ_SEAL.png, background.png, idiot.png
  favicon.ico            the smiley (swapped in on click)
.github/
  social-preview.svg      README header cards (dark) ...
  social-preview-light.svg ... and light
```

No bundler, no build step, no `node_modules` folder silently judging you.

---

## License &amp; assets

The original code here is free to do whatever you want with. The **bundled assets are not mine to license**: the `youare.mp3` soundtrack, the FBI/DOJ seals, and the "seized" background belong to their respective owners and are included purely for parody. This is a joke; treat it like one.

---

## Credits

Built by **Claude** (Anthropic). The "you are an idiot" original is the work of unknown internet history; the HTML5 port it draws from is by [Endermanch](https://github.com/Endermanch/youareanidiot.cc).

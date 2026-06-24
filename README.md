<div align="center">

<img src=".github/social-preview.svg#gh-dark-mode-only"       alt="YOU ARE AN IDIOT — inspired by youareanidiot.cc, on a Cloudflare Worker" width="820">
<img src=".github/social-preview-light.svg#gh-light-mode-only" alt="YOU ARE AN IDIOT — inspired by youareanidiot.cc, on a Cloudflare Worker" width="820">

[![Cloudflare Workers](https://img.shields.io/badge/Deployed_on-Cloudflare_Workers-f38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-22c55e.svg)]()
[![No build step](https://img.shields.io/badge/build-none-success.svg)]()
[![Static assets](https://img.shields.io/badge/served_from-Workers_Static_Assets-f38020.svg)](https://developers.cloudflare.com/workers/static-assets/)
[![Maturity](https://img.shields.io/badge/maturity-deeply_unserious-ff2d2d.svg)]()

</div>

<p align="center"><strong>Inspired by the infamous <a href="https://en.wikipedia.org/wiki/You_Are_an_Idiot">YouAreAnIdiot.org</a> JS trojan — wrapped in a fake "FBI domain seized" page — on a single Cloudflare Worker.</strong></p>

It opens as a convincing **"This Website Has Been Seized"** notice, complete with the FBI/DOJ seals and the visitor's **real IP, location, and ISP** under a "all connecting IP addresses are tracked" warning. The instant they interact at all — click, tap, or press any key — it detonates: a flashing figure takes over the screen, custom voice clips loop and stack, and a swarm of self-spawning popup windows bounces around.

> ⚠️ This is an obnoxious prank toy. Deploy it somewhere you're allowed to, and point it only at people who'll forgive you.

---

## What happens

1. **The bait.** A serious-looking federal seizure page (real seals over a dark backdrop) reads back the visitor's actual `IP · city, region, country · ISP` — pulled live from Cloudflare — with a blinking "connection logged & monitored" line, a timestamp, and a case number. It behaves like a normal page: no sound, no funny business, nothing leaks.
2. **The detonation.** Any gesture — click **Return to Safety**, tap, or press any key: the tab title flips to **YOU ARE AN IDIOT!**, the favicon swaps to the emote, the voice clips kick in, and the flashing black-and-white figure takes over the screen.
3. **The chaos.** Every gesture spawns popup windows that bounce erratically around the screen; interacting with *those* spawns more and stacks another out-of-phase copy of the audio, building into a proper wall of noise.

---

## Caveats

A.k.a. things browsers no longer let a prank do — none of these are bugs, they're the modern web:

- **Nothing starts with zero interaction.** Sound legally requires a user gesture, so everything waits for the first one — but *any* gesture counts: a click, a tap, or a single keypress (even Alt to alt-tab away). A pure glance-and-close-the-tab escapes, and there's no way around that.
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

The whole experience is one `public/index.html`: a fixed `#seized` overlay (the seizure notice) sitting on top of the hidden idiot layer. The first gesture hides the overlay, swaps the title/favicon, and "detonates."

</details>

<details>
<summary><strong>The interesting bits</strong></summary>

- **Random, stacking audio (Web Audio).** Two custom voice clips are decoded separately and silence-trimmed. Each repeat picks one at random (coin flip — so the same clip can play twice in a row). Each click stacks another voice through a limiter, with staggered start times so they build into cacophony rather than doubling in unison.
- **CSS flash figure.** The "you are an idiot" text and emote images sit inside a `filter:invert()` animation toggling at ~1.5fps via `step-end` keyframes — the same black-and-white strobing effect as the original, no SVG frames needed.
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
  index.html              the whole show: seizure overlay + flashing figure + the script
  media/voice1.mp3        custom voice clip 1
  media/voice2.mp3        custom voice clip 2
  images/                 emote.png, FBI_SEAL.png, DOJ_SEAL.png, background.png
  favicon.ico             the emote (swapped in on detonation)
.github/
  social-preview.svg      README header cards (dark) ...
  social-preview-light.svg ... and light
```

No bundler, no build step, no `node_modules` folder silently judging you.

---

## License &amp; assets

The original code here is free to do whatever you want with. The **bundled assets are not mine to license**: the FBI/DOJ seals and the "seized" background belong to their respective owners and are included purely for parody. This is a joke; treat it like one.

---

## Credits

Built by **Claude** (Anthropic). The original [YouAreAnIdiot.org](https://en.wikipedia.org/wiki/You_Are_an_Idiot) JS trojan is the work of unknown internet history; [youareanidiot.cc](https://enderman.ch) is the official HTML5 port by [Endermanch](https://github.com/Endermanch).

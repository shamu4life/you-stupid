# YOU ARE AN IDIOT — on a Cloudflare Worker

A faithful copy of the real [youareanidiot.cc](https://youareanidiot.cc) (the
modern HTML5 port of the legendary prank page), served from a single Cloudflare
Worker — with two extras wired in:

1. **Runs on a Cloudflare Worker** — the real site files are served out of
   `./public` via [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).
2. **Auto-fullscreen** — it enters fullscreen on the first interaction.
3. **Audio on first interaction** — the real "you are an idiot" song starts as
   soon as you touch the page.

The signature **click → spawn more popup windows** and **bouncing windows**
behavior is part of the original site and is preserved as-is.

> ⚠️ This is an obnoxious prank toy. Only point people at it as a joke, and only
> deploy it somewhere you're allowed to. Clicking the main page spawns 6 popups;
> each popup spawns 3 more.

## What's authentic vs. added

**Authentic (from the real site, unchanged):**
- `public/index.html` — the real main page, including the genuine **two-frame
  dancing SVG** (`.frame-black` / `.frame-white` alternate at 666 ms to animate).
- `public/lol.html` + `public/scripts/lol.js` — the real **popup** page. It loads
  only `math.js` + `lol.js`, so popups are **silent**, bounce around the screen,
  and spawn 3 more on click (only the main page plays sound).
- `public/safe.html`, `public/updates.html` — the real `/safe` and `/updates`
  pages linked from the UI.
- `public/media/youare.mp3` — the **real 320 kbps "you are an idiot" loop**.
- `public/styles/*.css`, `public/scripts/{safe,math,you,cleanup}.js`, the real
  `.avif` icons, `favicon.ico`, and `images/idiot.png` — all straight from the
  live site. Original JS: audio with self-overlap "for historic accuracy", the
  `procreate()` popup spawner, and `playBall()` window bouncing.

**Added / changed for this build:**
- `public/scripts/fullscreen.js` — auto-fullscreen + audio start on the first
  gesture (loaded by the main page only).
- `src/index.js` — the Worker that serves the assets and falls back to the main
  page for any unknown route (so stray links/typos still resolve).
- Removed the Cloudflare analytics beacon and the `/cdn-cgi` email-decode script.

## Project layout

```
src/index.js          Worker (static-asset router)
wrangler.toml         Worker config (points [assets] at ./public)
public/               the actual website that gets served
  index.html          main page (sound + auto-fullscreen, spawns 6 popups)
  lol.html            popup page (silent, bounces, spawns 3)
  safe.html, updates.html
  styles/styles.css, styles/markdown.css
  scripts/safe.js, math.js, you.js, cleanup.js, lol.js, fullscreen.js
  media/youare.mp3
  images/{speaker,speakerm,warning}.avif, images/idiot.png
  favicon.ico
```

## Run it locally

```bash
npm install
npm run dev        # http://localhost:8787
```

## Deploy it

```bash
npm install
npx wrangler login     # one-time browser auth
npm run deploy         # -> https://you-stupid.<your-subdomain>.workers.dev
```

The Worker name comes from `name` in `wrangler.toml` (`you-stupid`, to match the
connected Cloudflare project). This repo is also wired to Cloudflare's Git
integration, so pushes deploy automatically.

## Browser-behavior notes (why fullscreen/audio need a touch)

Every modern browser blocks fullscreen and audio-with-sound until the user
interacts — there is no way around this from a normal web page (the original
1990s/2000s version worked because old browsers allowed it). So this build does
the next best thing: the **first** pointer/key/touch event triggers fullscreen
and starts the song. True zero-interaction autoplay/fullscreen is only possible
in kiosk setups (e.g. Chrome launched with `--kiosk`).

Popups are likewise only allowed from a user gesture, and `window.moveTo` only
works on script-opened windows — so the bouncing applies to the spawned popups.
Strict popup blockers may cap how many windows open.

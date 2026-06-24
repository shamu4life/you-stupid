# YOU ARE AN IDIOT — on a Cloudflare Worker

A stripped-down recreation of [youareanidiot.cc](https://youareanidiot.cc),
served from a single Cloudflare Worker. Just the core prank — nothing else:

- The genuine **two-frame dancing SVG** (the `frame-black`/`frame-white` pair
  that swaps every 666 ms to animate), straight from the real site.
- The real **`youare.mp3`** soundtrack, **autoplaying on loop** — no mute button,
  no controls.
- **Auto-fullscreen** on first interaction.
- **Click → spawn popup windows** of itself; each popup bounces around the
  screen (the classic `playBall` behavior). Popups are silent so dozens of
  windows don't become an audio avalanche.

The maintainer's extras (top bar, mute toggle, links, footer, and the `/safe`
and `/updates` pages) have been removed.

> ⚠️ Obnoxious prank toy. Only point people at it as a joke, and only deploy it
> somewhere you're allowed to. The main page spawns 6 popups per click; each
> popup spawns 3 more.

## Files

```
src/index.js          Worker — serves ./public, falls back to the page for any route
wrangler.toml         Worker config (points [assets] at ./public)
public/
  index.html          the whole page: real SVG frames + inline CSS/JS + <audio>
  media/youare.mp3    the real song
  favicon.ico
```

It's one self-contained `index.html`: the two real SVG frames inline, plus a
small script that handles autoplay, fullscreen, and the popup/bounce behavior
(gated by `window.opener`, so popups stay silent and don't fullscreen).

## Run / deploy

```bash
npm install
npm run dev            # local: http://localhost:8787
# deploy:
npx wrangler login
npm run deploy         # -> https://you-stupid.<your-subdomain>.workers.dev
```

This repo is wired to Cloudflare's Git integration, so pushes deploy
automatically.

## Why audio/fullscreen need one click

No modern browser will start audio-with-sound or enter fullscreen with **zero**
interaction — it's blocked platform-wide (the old version got away with it in
the Flash era). So the song and fullscreen kick in on the **first**
click/keypress/tap. Since clicking is also what spawns popups, the song starts
the instant anyone interacts. Truly zero-touch is only possible in kiosk setups
(e.g. Chrome launched with `--kiosk --autoplay-policy=no-user-gesture-required`).

> Note: the live `*.workers.dev` URLs are currently behind **Cloudflare Access**
> (a login wall). To make the link public, disable Access on the Worker
> (Workers & Pages → you-stupid → Settings → Domains & Routes) or attach a
> custom domain.

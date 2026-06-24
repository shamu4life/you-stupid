# YOU ARE AN IDIOT — on a Cloudflare Worker

A self-contained recreation of the classic [youareanidiot.cc](https://en.wikipedia.org/wiki/You_Are_an_Idiot)
prank page, served entirely from a single Cloudflare Worker.

It does three extra things on top of the original look:

1. **Runs on a Cloudflare Worker** — the whole page (HTML, CSS, JS, the dancing
   face SVG, and a synthesized soundtrack) is inlined in `src/index.js`. There
   are no external assets to host, so the Worker is the only thing you deploy.
2. **Auto-fullscreen** — it jumps into fullscreen on the first interaction.
3. **Multiplying popups** — every click opens *another* popup window pointing
   back at the same page, so the windows breed. Each popup also bounces around
   the screen, exactly like the original.

> ⚠️ This is an obnoxious prank toy. Only point people at it as a joke, and only
> deploy it somewhere you're allowed to. The popups multiply on every click.

## What's in the box

```
src/index.js     The entire Worker + page (self-contained, no external assets)
wrangler.toml    Cloudflare Worker config
package.json     dev / deploy scripts (uses Wrangler)
```

## Run it locally

```bash
npm install
npm run dev
```

Wrangler prints a local URL (usually `http://localhost:8787`). Open it, click,
and enjoy the chaos.

## Deploy it

You need a (free) Cloudflare account.

```bash
npm install
npx wrangler login     # one-time browser auth
npm run deploy
```

Wrangler publishes it to `https://you-stupid.<your-subdomain>.workers.dev`.
The Worker name comes from `name` in `wrangler.toml` (set to `you-stupid` to
match the connected Cloudflare project); change it there to rename the Worker.

### Custom domain (optional)

Add your domain as a zone in the Cloudflare dashboard, then uncomment the
`routes` block in `wrangler.toml` and set the hostname:

```toml
routes = [
  { pattern = "youareanidiot.example.com", custom_domain = true }
]
```

Re-run `npm run deploy`.

## Browser-behavior notes (why these are unavoidable)

The web platform won't let a page do any of this without a user gesture — there
is no way around that from inside a normal web page, so the page is wired to
trigger everything on the **first click/keypress/tap**:

- **Fullscreen** requires a user gesture. The page requests it the instant you
  interact (hence the "click anywhere" hint). True zero-interaction fullscreen
  is only possible in kiosk setups (e.g. Chrome started with `--kiosk`).
- **Audio** is autoplay-blocked until you interact, so the soundtrack starts on
  the same first gesture. It's synthesized live with the Web Audio API — no
  copyrighted audio files involved.
- **Popups** are blocked unless opened from a user gesture, which is why a new
  window opens *per click*. If your browser's popup blocker is strict it may
  still cap or block them.
- **Moving windows** (`window.moveTo`) only works for script-opened popups, so
  the bouncing applies to the popups, not the main tab.

## How it works

`src/index.js` exports a standard Worker `fetch` handler:

- `GET /favicon.svg` (and `/favicon.ico`) → the grinning-face SVG.
- Any other path → the full inlined prank page.

Serving every path means popups can target any URL and still get the page,
keeping the cascade going.

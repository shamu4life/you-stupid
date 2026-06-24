// YOU ARE AN IDIOT — a self-contained recreation of the classic
// youareanidiot.cc, served entirely from a single Cloudflare Worker.
//
// Behavior:
//   * A green screen tiled with dancing grinning faces + scrolling banner.
//   * On the first user gesture it goes fullscreen and starts the
//     (synthesized, no external files) annoying loop.
//   * Every click opens ANOTHER popup window pointing back at this same
//     page, so the popups multiply — the signature "idiot" cascade.
//
// Everything is inlined: no external images, fonts, or audio, so the
// Worker is the only thing you deploy.

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<circle cx="60" cy="60" r="56" fill="#ffd21a" stroke="#000" stroke-width="6"/>
<circle cx="43" cy="48" r="8" fill="#000"/>
<circle cx="77" cy="48" r="8" fill="#000"/>
<path d="M28 66 Q60 104 92 66 Z" fill="#000"/>
<path d="M28 66 Q60 80 92 66 Q60 72 28 66 Z" fill="#fff"/>
<ellipse cx="60" cy="82" rx="12" ry="6" fill="#e23b2e"/>
</svg>`;

// NOTE: The page below lives inside a template literal. The embedded
// page-script therefore deliberately avoids backticks and ${...} so it is
// passed through verbatim.
const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="robots" content="noindex">
<title>YOU ARE AN IDIOT</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; width: 100%; height: 100%;
    overflow: hidden; background: #00a000;
    font-family: "Comic Sans MS", "Comic Sans", "Chalkboard", system-ui, sans-serif;
    cursor: crosshair; user-select: none; -webkit-user-select: none;
  }
  #stage { position: fixed; inset: 0; }
  #faces { position: absolute; inset: 0; }
  .face {
    position: absolute;
    animation: wobble 0.5s infinite ease-in-out;
    will-change: transform;
  }
  .face svg {
    width: 100%; height: 100%; display: block;
    filter: drop-shadow(2px 2px 0 rgba(0,0,0,.35));
  }
  @keyframes wobble {
    0%   { transform: translateY(0)     rotate(-10deg) scale(1);    }
    25%  { transform: translateY(-10px) rotate( 10deg) scale(1.06); }
    50%  { transform: translateY(0)     rotate(-10deg) scale(1);    }
    75%  { transform: translateY(-10px) rotate( 10deg) scale(1.06); }
    100% { transform: translateY(0)     rotate(-10deg) scale(1);    }
  }
  #banner {
    position: absolute; top: 50%; left: 0; right: 0;
    transform: translateY(-50%);
    overflow: hidden; white-space: nowrap; pointer-events: none;
  }
  #bannertext {
    display: inline-block; padding-left: 100%;
    font-size: clamp(40px, 11vw, 150px); font-weight: 900;
    color: #ffe400; -webkit-text-stroke: 3px #000;
    text-shadow: 4px 4px 0 #c00, 8px 8px 0 #000;
    animation: scroll 12s linear infinite, flash 0.4s steps(1) infinite;
  }
  @keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-100%); } }
  @keyframes flash {
    0%   { color: #ffe400; }
    50%  { color: #ff2d2d; }
    100% { color: #00e5ff; }
  }
  #hint {
    position: absolute; bottom: 18px; left: 0; right: 0; text-align: center;
    color: #fff; font-size: 18px; letter-spacing: 1px;
    text-shadow: 2px 2px 0 #000; pointer-events: none;
    animation: blink 1s steps(1) infinite;
  }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .face, #bannertext, #hint { animation: none; }
  }
</style>
</head>
<body>
<div id="stage">
  <div id="faces"></div>
  <div id="banner"><span id="bannertext">YOU&nbsp;ARE&nbsp;AN&nbsp;IDIOT!&nbsp;&nbsp;&nbsp;HA&nbsp;HA&nbsp;HA&nbsp;HA&nbsp;HA!&nbsp;&nbsp;&nbsp;</span></div>
  <div id="hint">click anywhere</div>
</div>
<script>
(function () {
  'use strict';

  var FACE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    + '<circle cx="60" cy="60" r="56" fill="#ffd21a" stroke="#000" stroke-width="5"/>'
    + '<circle cx="43" cy="48" r="7" fill="#000"/>'
    + '<circle cx="77" cy="48" r="7" fill="#000"/>'
    + '<path d="M28 66 Q60 104 92 66 Z" fill="#000"/>'
    + '<path d="M28 66 Q60 80 92 66 Q60 72 28 66 Z" fill="#fff"/>'
    + '<ellipse cx="60" cy="82" rx="12" ry="6" fill="#e23b2e"/>'
    + '</svg>';

  var facesEl = document.getElementById('faces');

  // ---- Build a field of dancing faces sized to the viewport ----
  function buildFaces() {
    var size = 84, gap = 18, step = size + gap;
    var cols = Math.ceil(window.innerWidth / step) + 1;
    var rows = Math.ceil(window.innerHeight / step) + 1;
    var html = '';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var delay = (((r + c) % 6) * 0.1);
        html += '<div class="face" style="width:' + size + 'px;height:' + size + 'px;left:'
          + (c * step) + 'px;top:' + (r * step) + 'px;animation-delay:' + delay + 's">'
          + FACE_SVG + '</div>';
      }
    }
    facesEl.innerHTML = html;
  }

  // ---- Fullscreen (allowed only from a user gesture) ----
  function goFullscreen() {
    var el = document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen
      || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!fn) return;
    try {
      var p = fn.call(el);
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  // ---- Synthesized annoying loop (no external audio files) ----
  var audioCtx = null, schedTimer = null;
  function startAudio() {
    if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();

    var master = audioCtx.createGain();
    master.gain.value = 0.16;
    master.connect(audioCtx.destination);

    function note(freq, start, dur, type, vol) {
      var osc = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol || 0.5, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g); g.connect(master);
      osc.start(start); osc.stop(start + dur + 0.02);
    }

    var A = 440, B = 493.88, Cs = 554.37, D = 587.33, E = 659.25, Fs = 739.99, A2 = 880;
    var melody = [A, Cs, E, A2, E, Cs, B, D, Fs, A2, Fs, D];
    var bass   = [A / 2, 0, A / 2, 0, E / 2, 0, E / 2, 0, Fs / 2, 0, Fs / 2, 0];
    var stepDur = 0.16, i = 0;
    var nextTime = audioCtx.currentTime + 0.1;

    function laugh(t) {
      for (var k = 0; k < 5; k++) note(420 - k * 35, t + k * 0.1, 0.07, 'sawtooth', 0.5);
    }

    function scheduler() {
      while (nextTime < audioCtx.currentTime + 0.25) {
        var m = melody[i % melody.length];
        if (m) note(m, nextTime, stepDur * 0.9, 'square', 0.5);
        var b = bass[i % bass.length];
        if (b) note(b, nextTime, stepDur * 1.6, 'triangle', 0.7);
        if (i % 24 === 0) laugh(nextTime);
        nextTime += stepDur;
        i++;
      }
    }
    scheduler();
    schedTimer = setInterval(scheduler, 60);
  }

  // ---- Popups that bounce around the screen ----
  function bounce(win, x, y, w, h) {
    var dx = (Math.random() < 0.5 ? -1 : 1) * 4;
    var dy = (Math.random() < 0.5 ? -1 : 1) * 4;
    var px = x, py = y;
    var sw = screen.availWidth || window.innerWidth;
    var sh = screen.availHeight || window.innerHeight;
    var t = setInterval(function () {
      if (!win || win.closed) { clearInterval(t); return; }
      px += dx; py += dy;
      if (px <= 0) { px = 0; dx = -dx; }
      if (py <= 0) { py = 0; dy = -dy; }
      if (px + w >= sw) { px = sw - w; dx = -dx; }
      if (py + h >= sh) { py = sh - h; dy = -dy; }
      try { win.moveTo(px, py); } catch (e) { clearInterval(t); }
    }, 25);
  }

  function spawnPopup() {
    var w = 360, h = 240;
    var sw = screen.availWidth || window.innerWidth;
    var sh = screen.availHeight || window.innerHeight;
    var x = Math.max(0, Math.floor(Math.random() * Math.max(1, sw - w)));
    var y = Math.max(0, Math.floor(Math.random() * Math.max(1, sh - h)));
    var feat = 'width=' + w + ',height=' + h + ',left=' + x + ',top=' + y
      + ',menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no';
    var win = null;
    try { win = window.open(window.location.href, '_blank', feat); } catch (e) { win = null; }
    if (win) bounce(win, x, y, w, h);
    return win;
  }

  // ---- Wire it all up ----
  var armed = false;
  function arm() {
    if (armed) return;
    armed = true;
    goFullscreen();
    startAudio();
    var hint = document.getElementById('hint');
    if (hint) hint.style.display = 'none';
  }

  function onClick() {
    arm();        // first gesture: fullscreen + sound
    spawnPopup(); // every click duplicates: open another popup window
  }

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', arm);
  document.addEventListener('touchstart', arm, { passive: true });

  // Classic "you can't get rid of me" nag.
  window.addEventListener('beforeunload', function (e) {
    e.preventDefault();
    e.returnValue = 'You are an idiot!';
    return 'You are an idiot!';
  });

  // Try to start as early as the browser allows (usually blocked until a gesture).
  window.addEventListener('load', function () { try { startAudio(); } catch (e) {} });
  window.addEventListener('resize', buildFaces);

  buildFaces();
})();
</script>
</body>
</html>`;

const SECURITY_HEADERS = {
  // window.open + popups + audio all need to work; keep it permissive but sane.
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/favicon.svg' || url.pathname === '/favicon.ico') {
      return new Response(FAVICON_SVG, {
        headers: {
          'content-type': 'image/svg+xml; charset=utf-8',
          'cache-control': 'public, max-age=86400',
        },
      });
    }

    // Everything else just serves the page (so popups to any path work too).
    return new Response(PAGE, { headers: SECURITY_HEADERS });
  },
};

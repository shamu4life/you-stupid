/*
 * Added on top of the original site for the Cloudflare Worker build:
 *   - auto-enter fullscreen on the first user interaction (the main window only)
 *   - start the audio as early as the browser allows
 *
 * Browsers forbid both fullscreen and audio-with-sound without a user gesture,
 * so the earliest we can legally do it is the first pointer/key/touch event.
 * Loaded only by index.html (the main page), after safe.js (which defines the
 * audioPlay() + audio globals it reuses).
 */
(function () {
	'use strict';

	function inFullscreen() {
		return document.fullscreenElement || document.webkitFullscreenElement
			|| document.mozFullScreenElement || document.msFullscreenElement;
	}

	function goFullscreen() {
		if (window.opener) return;            // popups stay as little bouncing windows
		if (inFullscreen()) return;
		var el = document.documentElement;
		var fn = el.requestFullscreen || el.webkitRequestFullscreen
			|| el.mozRequestFullScreen || el.msRequestFullscreen;
		if (!fn) return;
		try { var p = fn.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) {}
	}

	function kickAudio() {
		try {
			// Reuse the site's real play+overlap path so it sounds authentic.
			if (typeof audioPlay === 'function' && typeof audio !== 'undefined' && audio.paused) {
				audioPlay();
			}
		} catch (e) {}
	}

	function onGesture() { kickAudio(); goFullscreen(); }

	var evs = ['pointerdown', 'touchstart', 'keydown', 'click'];
	for (var i = 0; i < evs.length; i++) {
		window.addEventListener(evs[i], onGesture, true);
	}

	// Optimistic attempt the instant the page loads (usually blocked until a gesture).
	window.addEventListener('load', function () {
		try {
			if (typeof audio !== 'undefined') {
				var p = audio.play();
				if (p && p.catch) p.catch(function () {});
			}
		} catch (e) {}
	});
})();

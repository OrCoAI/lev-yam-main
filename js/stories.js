'use strict';

/* ── Behaviour for /stories/ pages ────────────────────────────────────────────
   Story pages deliberately do NOT load js/app.js. That file is ~900 lines of
   homepage-only behaviour (hero video, gallery lightbox, map, carousel, mobile
   nav) built around a client-side language swap — one URL showing either
   language. Story pages use the opposite model: one URL per language, paired by
   hreflang, which is what search engines need to rank and serve the right twin.

   (A side effect of that split worth knowing: app.js's applyTranslations also
   rewrites document.title and the description/og meta from the homepage
   dictionary, so loading it here would erase each page's own SEO metadata. See
   docs/ROADMAP.md for making that opt-in like the rest of its i18n layer.)

   So there is very little to do here: remember the language choice, report
   WhatsApp CTA clicks, run the mobile menu, and autoplay an opted-in video.
   Requires js/wa-track.js to be loaded first.                                */

(function () {
  var LANG_KEY = 'lev-yam-lang';
  var lang = document.documentElement.lang || 'he';

  /* Two writes to the cross-surface language key (js/app.js reads it at boot):

     1. On load, only if UNSET — an Arabic visitor arriving on /stories/ar/…
        from search has no lev-yam-lang yet, and their next click through to
        the homepage (which defaults to Hebrew) would switch language on them.
        Seeding only when unset means merely opening a shared cross-language
        story link never clobbers a preference someone chose explicitly.

     2. On a lang-toggle click — that IS an explicit choice, recorded before
        the navigation to the twin URL. The toggle stays a plain link, so with
        JS disabled navigation still works (the preference just isn't stored,
        same as on the homepage). */
  try {
    if (!localStorage.getItem(LANG_KEY)) localStorage.setItem(LANG_KEY, lang);
  } catch (err) { /* localStorage blocked — navigation still works */ }

  document.addEventListener('click', function (e) {
    var opt = e.target && e.target.closest && e.target.closest('.lang-opt[hreflang]');
    if (!opt) return;
    try {
      localStorage.setItem(LANG_KEY, opt.getAttribute('hreflang'));
    } catch (err) { /* ignore */ }
  });

  var track = window.LevYamTrack;
  if (!track) return; // js/wa-track.js missing — CTAs still work, just untracked

  track.onWhatsAppClick(function (link) {
    track.whatsappClick({
      source: link.getAttribute('data-bizevent-source') || 'story',
      lang:   lang
    });
  });
})();

/* ── Mobile menu toggle ───────────────────────────────────────────────────
   The homepage hamburger (app.js), minus its i18n layer: story pages are one
   language per URL, so the open/close aria-labels come baked into the button
   as data-label-open / data-label-close. Same markup, same behaviour. */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  if (!toggle || !mobileNav) return;

  function refreshLabel() {
    var isOpen = toggle.getAttribute('aria-expanded') === 'true';
    var label = toggle.getAttribute(isOpen ? 'data-label-close' : 'data-label-open');
    if (label) toggle.setAttribute('aria-label', label);
  }

  function closeMenu() {
    toggle.setAttribute('aria-expanded', 'false');
    mobileNav.hidden = true;
    refreshLabel();
  }

  toggle.addEventListener('click', function () {
    if (toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      return;
    }
    toggle.setAttribute('aria-expanded', 'true');
    mobileNav.hidden = false;
    refreshLabel();
  });

  var btnClose = mobileNav.querySelector('.mobile-nav-close');
  if (btnClose) {
    btnClose.addEventListener('click', function () { closeMenu(); toggle.focus(); });
  }

  mobileNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });
})();

/* ── Muted autoplay for <video data-autoplay> ─────────────────────────────
   A story video downloads nothing until it scrolls into view (preload="none"
   stays on the tag), then plays — muted and looping from its own attributes —
   while it is on screen, and pauses when it leaves, so a reader who never
   scrolls that far pays only the poster (ADR 0051). Reduced-motion and
   save-data visitors, and anyone without JS, get the plain tap-to-play video.
   Once someone pauses it themselves it stays paused until they press play. */
(function () {
  var videos = document.querySelectorAll('video[data-autoplay]');
  if (!videos.length || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (navigator.connection && navigator.connection.saveData) return;

  var VISIBLE = 0.4;
  var autoPaused = new WeakSet();
  var readerPaused = new WeakSet();
  var readerPlayed = new WeakSet(); // pressed play after pausing — don't undo it on re-observe
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var video = entry.target;
      if (readerPlayed.delete(video) && entry.intersectionRatio < VISIBLE) return;
      if (entry.intersectionRatio >= VISIBLE) {
        video.play().catch(function () { /* autoplay refused — controls remain */ });
      } else if (!video.paused) {
        autoPaused.add(video);
        video.pause();
      }
    });
  }, { threshold: [0, VISIBLE] });

  videos.forEach(function (video) {
    video.addEventListener('pause', function () {
      if (autoPaused.delete(video) || document.hidden) return; // ours, or the browser backgrounding the tab
      readerPaused.add(video); // the reader paused it
      observer.unobserve(video);
    });
    video.addEventListener('play', function () {
      if (!readerPaused.delete(video)) return; // our own play(), or never reader-paused
      readerPlayed.add(video);
      observer.observe(video);
    });
    observer.observe(video);
  });

  // A backgrounded tab pauses media without an intersection change; re-observing
  // on return delivers a fresh callback that resumes (or keeps paused) as usual.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    videos.forEach(function (video) {
      if (readerPaused.has(video)) return;
      observer.unobserve(video);
      observer.observe(video);
    });
  });
})();

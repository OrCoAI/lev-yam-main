'use strict';

/* ── Site chrome: the behaviour every public page shares ──────────────────────
   The header, the phone menu and the floating WhatsApp button are the same
   markup on every page - the homepage, /business/, /stories/, /happening/.
   This file is the behaviour that goes with that markup, so no page has to
   carry its own copy and no page is left without it:

     1. the header comes back as a slim bar once its band has scrolled away;
     2. the open phone menu dims the page behind it, closes on a tap outside
        and holds the page still (opening and closing stay with each page's own
        script, which knows its labels);
     3. the floating WhatsApp button steps aside for the page's own WhatsApp
        button and for rows whose control it would sit on, and stops pulsing
        after the first interaction.

   No dependencies. Every part checks for its own markup, so the file is safe
   on a page that lacks one of them. Without JS the header stays in its band,
   the menu button does nothing harmful and the floating button simply stays. */

/* ── 1. Header: stays with the visitor ───────────────────────────────────── */
(function () {
  var bar = document.querySelector('.hero-topbar');
  if (!bar || !('IntersectionObserver' in window)) return;
  // The homepage and /business/ open on a hero the bar lies over: it sticks
  // once all but the hero's last 80px have gone. The other pages give it a
  // band of its own (.story-header): it sticks 24px after the band has gone.
  // An observer, not a scroll listener - nothing runs while the page scrolls.
  var hero = document.querySelector('.hero');
  new IntersectionObserver(function (entries) {
    bar.classList.toggle('is-stuck', !entries[0].isIntersecting);
  }, { rootMargin: hero ? '-80px 0px 0px 0px' : '24px 0px 0px 0px' }).observe(hero || bar.parentElement);
})();

/* ── 2. Phone menu: a backdrop, a tap outside, a page that holds still ───── */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('mobile-nav');
  if (!toggle || !nav) return;

  function isOpen() { return toggle.getAttribute('aria-expanded') === 'true'; }

  // `menu-open` on <html> draws the backdrop and locks the scroll (CSS). It
  // follows aria-expanded, whichever script flipped it. On opening, the
  // keyboard moves into the menu (its close button covers the toggle).
  if ('MutationObserver' in window) {
    new MutationObserver(function () {
      var open = isOpen();
      document.documentElement.classList.toggle('menu-open', open);
      var closeBtn = nav.querySelector('.mobile-nav-close');
      if (open && closeBtn) closeBtn.focus();
    }).observe(toggle, { attributes: true, attributeFilter: ['aria-expanded'] });
  }

  // ...and stays there: Tab cycles through the menu instead of walking out
  // onto the dimmed page behind it.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !isOpen()) return;
    var stops = nav.querySelectorAll('a[href], button:not([disabled])');
    if (!stops.length) return;
    var first = stops[0];
    var last = stops[stops.length - 1];
    var inside = nav.contains(document.activeElement);
    if (e.shiftKey && (!inside || document.activeElement === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
      e.preventDefault();
      first.focus();
    }
  });

  // A tap outside the open menu closes it and does nothing else: the tap is
  // swallowed, so it never also follows a link that happened to lie under it.
  document.addEventListener('click', function (e) {
    if (!isOpen() || nav.contains(e.target) || toggle.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    toggle.click(); // the page's own handler closes and relabels
  }, true);
})();

/* ── 3. Floating WhatsApp button: its manners ───────────────────────────── */
(function () {
  var btn = document.querySelector('.wa-float');
  if (!btn) return;

  // The pulse is an introduction, not a habit: it stops at the first scroll
  // or tap, and stays stopped on later pages.
  var SEEN = 'lev-yam-wa-interacted';
  var seen = false;
  try { seen = !!localStorage.getItem(SEEN); } catch (err) { /* storage blocked */ }
  if (seen) {
    btn.classList.add('pulse-stopped');
  } else {
    var stopPulse = function () {
      btn.classList.add('pulse-stopped');
      try { localStorage.setItem(SEEN, '1'); } catch (err) { /* storage blocked */ }
      document.removeEventListener('click', stopPulse);
      document.removeEventListener('scroll', stopPulse);
    };
    document.addEventListener('click', stopPulse);
    document.addEventListener('scroll', stopPulse, { passive: true });
  }

  if (!('IntersectionObserver' in window)) return;
  var inTheWay = new Set();
  function watch(selector, options) {
    var targets = document.querySelectorAll(selector);
    if (!targets.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) inTheWay.add(entry.target);
        else inTheWay.delete(entry.target);
      });
      btn.classList.toggle('is-away', inTheWay.size > 0);
    }, options);
    targets.forEach(function (el) { io.observe(el); });
  }

  // One main action per screen: the button steps aside while the page's own
  // call to action - its WhatsApp button, its planner, its "plan your day"
  // button - is anywhere on screen.
  watch('.hero-ctas, [data-planner], #planner, .story-cta, .fit-cta', { threshold: 0 });

  // Phones: rows that open (a question's "+", a pillar's chevron) carry their
  // control at the same corner the button floats in. It steps aside while
  // such a row is in the bottom fifth of the screen - where it would sit on
  // that control.
  if (window.matchMedia('(max-width: 640px)').matches) {
    watch('.faq-item, .pillar-head', { rootMargin: '-80% 0px 0px 0px', threshold: 0 });
  }
})();

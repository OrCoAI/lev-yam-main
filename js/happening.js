'use strict';

/* ── Behaviour for the "What's happening" surface ─────────────────────────
   Two places load this, after js/happening-config.js and
   js/happening-render.js:
     · the hubs             (/happening/, /happening/ar/ — the full list)
     · a landing page       (/happening/<slug>/ — generated at deploy)
   Every page is static HTML rendered at deploy (scripts/gen-happening.mjs);
   this refreshes it from the platform's public feed on load, so an edit,
   an unpublish or a date that passed since the last rebuild shows within
   seconds. The static markup is the fallback: a fetch failure leaves the
   page exactly as it was built.

   The feed is events.feed / events.passed, read anonymously through
   PostgREST with the publishable key (RLS + column grants are the guard —
   docs/ARCHITECTURE.md). Nothing here writes.

   Sharing (ADR 0056/0057): the share row's buttons carry data-share =
   whatsapp | copy | native | qr; every use reports
   LevYamTrack.shareClick({channel, lang}). The WhatsApp CTA (a wa.me link
   TO the venue's number) reports whatsappClick with its
   data-bizevent-source, exactly as the stories pages do. The share link
   (wa.me/?text=…, no number) is deliberately not matched as a CTA — which
   is also why a landing page runs the header drawer itself instead of
   loading js/stories.js: that file's matcher takes every wa.me link.       */

(function () {
  var cfg = window.LEVYAM_FEED;
  var R = window.LevYamHappeningRender;

  /* ── a small photo that fails falls back to the full one ───────────────
     Cards and the calendar show a photo's small copy (-sm.jpg); photos
     uploaded before the copies existed have none. `error` does not bubble,
     so this listens in the capture phase — and an image that already failed
     before this script ran is caught by the sweep right after. An image
     rendered later always reports through the listener (a load error is a
     queued task, never synchronous), so there is nothing to sweep then. */
  function toFull(img) {
    var full = img.getAttribute('data-full');
    if (full && img.getAttribute('src') !== full) { img.removeAttribute('data-full'); img.src = full; }
  }
  document.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'IMG') toFull(e.target);
  }, true);
  document.querySelectorAll('img[data-full]').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) toFull(img);
  });

  if (!cfg || !R) return; /* config or renderer missing — the static page stands */

  var lang = function () { return document.documentElement.lang === 'ar' ? 'ar' : 'he'; };
  var track = window.LevYamTrack;

  /* ── the feed ──────────────────────────────────────────────────────── */
  function view(name, query) {
    var req = R.viewRequest(cfg, name, query);
    return fetch(req.url, { headers: req.headers }).then(function (res) {
      if (!res.ok) throw new Error('feed ' + res.status);
      return res.json();
    });
  }
  var liveItems = null; /* fetched once per page — the list columns only (R.LIST_QUERY) */
  function live() {
    if (!liveItems) liveItems = view('feed', R.LIST_QUERY);
    return liveItems;
  }

  /* ── the hubs' list: twelve cards, then a button for twelve more ─────
     The built page lists every item (without JavaScript it is the whole
     list); refreshed, the list opens on the first PAGE and grows on request,
     so a hundred items is not a hundred photos on a phone. The first card a
     press reveals takes the focus. */
  var PAGE = 12;
  function paginate(ul) {
    var old = ul.nextElementSibling;
    if (old && old.hasAttribute('data-hp-more')) old.remove();
    var cards = ul.querySelectorAll(':scope > li');
    if (cards.length <= PAGE) return;
    for (var i = PAGE; i < cards.length; i++) cards[i].hidden = true;
    var wrap = document.createElement('p');
    wrap.className = 'hp-more';
    wrap.setAttribute('data-hp-more', '');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hp-more-link';
    btn.textContent = R.labels(lang()).showMore;
    wrap.appendChild(btn);
    ul.parentNode.insertBefore(wrap, ul.nextSibling);
    btn.addEventListener('click', function () {
      var rest = ul.querySelectorAll(':scope > li[hidden]');
      for (var k = 0; k < rest.length && k < PAGE; k++) rest[k].hidden = false;
      var first = rest[0] && rest[0].querySelector('a');
      if (rest.length <= PAGE) wrap.remove();
      if (first) first.focus();
    });
  }
  var lists = document.querySelectorAll('[data-happening-list]');
  if (lists.length) {
    live().then(function (items) {
      var l = lang();
      lists.forEach(function (ul) {
        ul.innerHTML = R.listHtml(cfg, items, l, { heading: 'h2', eager: true });
        paginate(ul);
      });
    }).catch(function () { /* the built list stands */ });
  }

  /* ── the hub's calendar: one month at a time, a marked day opens its
     items beside the month. Shown only once the feed answered (without
     JavaScript, or if the feed is down, the cards below are the list). ── */
  var cal = document.querySelector('[data-happening-calendar]');
  if (cal) {
    /* "today" is Jerusalem's, as the feed's next_date is (events.next_occurrence);
       a visitor east of Israel would otherwise see a live day as past */
    var now = new Date();
    var today;
    try {
      today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    } catch (e) {
      today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    }
    var calState = { year: parseInt(today.slice(0, 4), 10), month: parseInt(today.slice(5, 7), 10) - 1, selected: null, items: [] };
    function renderCal(focusDay) {
      var l = lang();
      var index = R.monthIndex(calState.items, calState.year, calState.month, today);
      if (calState.selected && !index[calState.selected]) calState.selected = null;
      if (!calState.selected) calState.selected = index[today] ? today : (Object.keys(index).sort()[0] || null);
      cal.innerHTML =
        '<div class="hp-cal-month">' + R.calendarHtml(calState.items, l, calState.year, calState.month, calState.selected, today) + '</div>' +
        '<div class="hp-cal-panel">' + R.dayPanelHtml(cfg, index[calState.selected] || [], l, calState.selected) + '</div>';
      cal.hidden = false;
      if (focusDay) { var el = cal.querySelector('[data-cal-day="' + calState.selected + '"]'); if (el) el.focus(); }
    }
    cal.addEventListener('click', function (e) {
      var step = e.target.closest('[data-cal-step]');
      if (step) {
        var m = calState.month + parseInt(step.getAttribute('data-cal-step'), 10);
        calState.year += Math.floor(m / 12);
        calState.month = ((m % 12) + 12) % 12;
        calState.selected = null;
        renderCal(false);
        /* the arrow was rebuilt with the month: keep the keyboard on it (or on
           the other one when it rendered disabled at the current month) */
        var again = cal.querySelector('[data-cal-step="' + step.getAttribute('data-cal-step') + '"]:not(:disabled)') ||
          cal.querySelector('[data-cal-step]:not(:disabled)');
        if (again) again.focus();
        return;
      }
      var day = e.target.closest('[data-cal-day]');
      if (day) { calState.selected = day.getAttribute('data-cal-day'); renderCal(true); }
    });
    live().then(function (items) {
      calState.items = items;
      /* a month with nothing left in it (the end of the month, say) opens on
         the first month ahead that has something, up to a year out; nothing
         ahead at all keeps this month */
      var hasItems = function (y, m) { return Object.keys(R.monthIndex(items, y, m, today)).length > 0; };
      var y = calState.year, m = calState.month;
      for (var k = 0; k < 12 && !hasItems(y, m); k++) { m += 1; if (m === 12) { m = 0; y += 1; } }
      if (hasItems(y, m)) { calState.year = y; calState.month = m; }
      renderCal(false);
    }).catch(function () { /* stays hidden */ });
  }

  /* ── a landing page ────────────────────────────────────────────────── */
  var slug = document.body.getAttribute('data-happening-slug');
  if (slug) {
    var l = lang();
    var absolute = location.origin + location.pathname;

    /* one URL per language, paired by hreflang: remember an explicit choice
       (the lang toggle), seed the cross-surface key only when unset — the
       same rule js/stories.js follows */
    try {
      if (!localStorage.getItem('lev-yam-lang')) localStorage.setItem('lev-yam-lang', l);
    } catch (e) { /* blocked — navigation still works */ }
    document.addEventListener('click', function (e) {
      var opt = e.target && e.target.closest && e.target.closest('.lang-opt[hreflang]');
      if (!opt) return;
      try { localStorage.setItem('lev-yam-lang', opt.getAttribute('hreflang')); } catch (e2) { /* ignore */ }
    });

    var $ = function (name) { return document.querySelector('[data-hp="' + name + '"]'); };
    var $$ = function (name) { return document.querySelectorAll('[data-hp="' + name + '"]'); };
    var setText = function (name, value) { $$(name).forEach(function (el) { el.textContent = value; }); };

    function setState(state) {
      document.body.setAttribute('data-hp-state', state);
      document.querySelectorAll('[data-hp-banner]').forEach(function (b) {
        b.hidden = b.getAttribute('data-hp-banner') !== state;
      });
    }

    /* text and gallery edits show without waiting for a rebuild */
    function refresh(item) {
      setText('title', R.text(item, 'title', l));
      setText('summary', R.text(item, 'summary', l));
      $$('when').forEach(function (t) { t.innerHTML = R.whenHeroHtml(item, l); });
      $$('when-tile').forEach(function (t) {
        var lines = R.whenLines(item, l), spans = t.querySelectorAll('[data-hp-line]');
        t.setAttribute('datetime', R.keyDate(item));
        if (spans[0]) spans[0].textContent = lines[0];
        if (spans[1]) { spans[1].textContent = lines[1]; spans[1].hidden = !lines[1]; }
      });
      var costRow = $('cost');
      if (costRow) {
        var cost = R.text(item, 'cost', l);
        costRow.hidden = !R.hasCost(item, l);
        var lines = costRow.querySelectorAll('[data-hp-line]');
        if (lines[0]) { lines[0].textContent = cost; lines[0].hidden = !cost; }
        if (lines[1]) lines[1].textContent = R.bookingText(item, l);
      }
      ['audience', 'bring'].forEach(function (f) {
        var v = R.text(item, f, l);
        var row = $(f);
        if (!row) return;
        row.hidden = !v;
        var dd = row.querySelector('dd');
        if (dd) dd.textContent = v;
      });
      /* the tile that spans both columns — the rule the generator applied */
      var wide = R.wideFact(item, l);
      ['cost', 'audience', 'bring'].forEach(function (f) {
        var row = $(f);
        if (row) row.classList.toggle('hp-fact-wide', wide === f);
      });
      var body = $('body');
      if (body) body.innerHTML = R.paragraphsHtml(R.text(item, 'body', l));
      /* the photos are rebuilt only when the set changed — a rebuild restarts
         the slideshow, and the built page already carries the same photos */
      var gallery = $('gallery');
      if (gallery) {
        var paths = JSON.stringify(item.image_paths || []);
        if (gallery.getAttribute('data-hp-paths') !== paths) {
          gallery.innerHTML = R.galleryHtml(cfg, item, l);
          gallery.setAttribute('data-hp-paths', paths);
          gallery.parentElement.hidden = !(item.image_paths || []).length;
          initSlides();
        }
      }
      var hero = $('cover');
      if (hero) hero.src = R.cover(cfg, item);
      $$('cta').forEach(function (a) { a.href = R.ctaHref(item, l); });
      $$('share-wa').forEach(function (a) { a.href = R.shareWaHref(item, l, absolute); });
      document.body.setAttribute('data-hp-title', R.text(item, 'title', l));
    }

    /* ── the photos: an automatic crossfade when there are several ─────
       3 s a photo; a hover, a keyboard focus, a hidden tab or a slideshow
       that scrolled out of view pauses it; arrows, dots, a swipe and the
       arrow keys move it by hand (and restart the clock). Reduced motion:
       no autoplay at all — the controls still work. Re-run whenever the
       gallery is re-rendered from the live feed. */
    var slidesStop = null;
    var keyboard = false; /* the last input was a Tab: a focus then means a reader, not a tap */
    document.addEventListener('keydown', function (e) { if (e.key === 'Tab') keyboard = true; });
    document.addEventListener('pointerdown', function () { keyboard = false; });
    function initSlides() {
      if (slidesStop) { slidesStop(); slidesStop = null; }
      var root = document.querySelector('[data-slides]');
      if (!root) return;
      var slides = root.querySelectorAll('.hp-slide');
      var dots = root.querySelectorAll('[data-slide-to]');
      var count = root.querySelector('[data-slide-count]');
      var n = slides.length;
      if (n < 2) return;
      var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      var DWELL = 3000;
      var i = 0, timer = null, paused = false, visible = true, x0 = null;

      function show(k) {
        i = (k + n) % n;
        slides.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
        dots.forEach(function (d, j) {
          d.classList.toggle('is-active', j === i);
          if (j === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
        });
        if (count) count.textContent = (i + 1) + ' / ' + n;
      }
      function stop() { if (timer) clearTimeout(timer); timer = null; }
      function tick() {
        stop();
        if (still || paused || !visible || document.hidden) return;
        timer = setTimeout(function () { show(i + 1); tick(); }, DWELL);
      }
      function go(k) { show(k); tick(); }

      root.addEventListener('click', function (e) {
        var step = e.target.closest('[data-slide-step]');
        if (step) return go(i + parseInt(step.getAttribute('data-slide-step'), 10));
        var to = e.target.closest('[data-slide-to]');
        if (to) go(parseInt(to.getAttribute('data-slide-to'), 10));
      });
      root.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { paused = true; stop(); } });
      root.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { paused = false; tick(); } });
      root.addEventListener('focusin', function () { if (keyboard) { paused = true; stop(); } });
      root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) { paused = false; tick(); } });
      /* a swipe: both languages are RTL, so a swipe to the left reveals the next photo */
      root.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') x0 = e.clientX; });
      root.addEventListener('pointerup', function (e) {
        if (x0 == null) return;
        var dx = e.clientX - x0;
        x0 = null;
        if (Math.abs(dx) >= 40) go(dx < 0 ? i + 1 : i - 1);
      });
      root.addEventListener('pointercancel', function () { x0 = null; });
      root.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(i + 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(i - 1); }
      });
      var onVisibility = function () { tick(); };
      document.addEventListener('visibilitychange', onVisibility);
      var io = null;
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; tick(); }, { threshold: 0.3 });
        io.observe(root);
      }
      show(0);
      tick();
      slidesStop = function () { stop(); document.removeEventListener('visibilitychange', onVisibility); if (io) io.disconnect(); };
    }
    initSlides();

    /* ── the header drawer: the story chrome's hamburger (js/stories.js's
       copy, minus the WhatsApp matcher that would double-count here) ──── */
    (function () {
      var toggle = document.querySelector('.nav-toggle');
      var nav = document.getElementById('mobile-nav');
      if (!toggle || !nav) return;
      function relabel() {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        var label = toggle.getAttribute(open ? 'data-label-close' : 'data-label-open');
        if (label) toggle.setAttribute('aria-label', label);
      }
      function close() { toggle.setAttribute('aria-expanded', 'false'); nav.hidden = true; relabel(); }
      toggle.addEventListener('click', function () {
        if (toggle.getAttribute('aria-expanded') === 'true') { close(); return; }
        toggle.setAttribute('aria-expanded', 'true');
        nav.hidden = false;
        relabel();
      });
      var btnClose = nav.querySelector('.mobile-nav-close');
      if (btnClose) btnClose.addEventListener('click', function () { close(); toggle.focus(); });
      nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { close(); toggle.focus(); }
      });
    })();

    /* the sticky bar only once the action panel has scrolled away — two
       identical buttons on one screen read as a mistake */
    var sticky = document.querySelector('.hp-sticky');
    var panel = document.querySelector('.hp-actions');
    if (sticky && panel && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        sticky.classList.toggle('is-off', entries[0].isIntersecting);
      }, { threshold: 0.35 }).observe(panel);
    }

    /* the list (light) and this page's own row (whole) in parallel; a row
       not in the feed is looked up among the recently passed */
    function showMore(items, current) {
      var next = $('next');
      if (!next) return;
      next.innerHTML = R.listHtml(cfg, R.moreItems(items, current, 3), l, { heading: 'h3', more: true });
    }
    var bySlug = 'select=*&slug=eq.' + encodeURIComponent(slug);
    Promise.all([live(), view('feed', bySlug)]).then(function (res) {
      var items = res[0], mine = res[1][0];
      if (mine) {
        refresh(mine);
        setState('live');
        showMore(items, mine);
        return;
      }
      return view('passed', bySlug).then(function (rows) {
        if (rows[0]) { refresh(rows[0]); setState('passed'); showMore(items, rows[0]); }
        else { setState('unavailable'); showMore(items, { slug: slug }); } /* unpublished since the last rebuild — never "passed", which would be untrue */
      });
    }).catch(function () { /* the page as built stands */ });

    /* ── sharing ───────────────────────────────────────────────────────── */
    var title = function () { return document.body.getAttribute('data-hp-title') || document.title; };

    function report(channel) {
      if (track && typeof track.shareClick === 'function') track.shareClick({ channel: channel, lang: l });
    }

    /* Copies the page URL and says so for 2 s: the button's <span data-label>
       changes (the icon stays); an icon-only button (the sticky bar) gets the
       label as its title and the done colour. Reported as a share only once the
       copy actually happened — a denied clipboard is not a share. */
    function copyLink(btn) {
      var done = function () {
        report('copy');
        var label = btn.getAttribute('data-copied');
        if (!label) return;
        var span = btn.querySelector('[data-label]');
        var was = span ? span.textContent : btn.getAttribute('title');
        if (span) span.textContent = label; else btn.setAttribute('title', label);
        btn.classList.add('is-done');
        setTimeout(function () {
          if (span) span.textContent = was; else if (was) btn.setAttribute('title', was); else btn.removeAttribute('title');
          btn.classList.remove('is-done');
        }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(absolute).then(done, function () { /* denied — nothing to undo */ });
      } else {
        /* no async clipboard (old WebView): select the URL in a scratch field */
        var input = document.createElement('input');
        input.value = absolute;
        document.body.appendChild(input);
        input.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
        input.remove();
      }
    }

    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-share]');
      if (!el) return;
      var channel = el.getAttribute('data-share');
      if (channel === 'copy') copyLink(el);
      else if (channel === 'native') {
        if (navigator.share) {
          navigator.share({ title: title(), text: R.labels(l).brand + ' · ' + title(), url: absolute })
            .then(function () { report('native'); }, function () { /* dismissed */ });
        } else copyLink(el); /* no share sheet (desktop) — the link is copied instead */
      }
      else if (channel === 'whatsapp') report('whatsapp');
      /* qr: a <details>; counted when it opens (below), not on every click */
    });
    document.querySelectorAll('details[data-share-qr]').forEach(function (d) {
      d.addEventListener('toggle', function () { if (d.open) report('qr'); });
    });

    /* the CTA: a wa.me link to the venue's number, never the share link. The
       stamped chrome's links carry the story surface's source names — reported
       under this surface's */
    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest && e.target.closest('a[href*="wa.me/' + R.PHONE + '"]');
      if (!link || !track) return;
      var source = (link.getAttribute('data-bizevent-source') || 'happening').replace(/^stories_/, 'happening-');
      track.whatsappClick({ source: source, lang: l });
    });
  }
})();

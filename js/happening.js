'use strict';

/* ── Behaviour for the "What's happening" surface ─────────────────────────
   Three places load this, after js/happening-config.js and
   js/happening-render.js:
     · the homepage strip   (index.html — the next 3 live items)
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
   (wa.me/?text=…, no number) is deliberately not matched as a CTA.        */

(function () {
  var cfg = window.LEVYAM_FEED;
  var R = window.LevYamHappeningRender;
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
  var liveItems = null; /* fetched once per page */
  function live() {
    if (!liveItems) liveItems = view('feed', R.FEED_QUERY);
    return liveItems;
  }

  /* ── lists: the hubs and the homepage strip ────────────────────────── */
  var lists = document.querySelectorAll('[data-happening-list]');
  var strip = document.querySelector('[data-happening-strip]');
  var listItems = null;

  function renderLists() {
    if (!listItems) return;
    var l = lang();
    lists.forEach(function (ul) {
      var limit = parseInt(ul.getAttribute('data-limit'), 10) || listItems.length;
      var except = ul.getAttribute('data-except');
      var items = listItems.filter(function (it) { return it.slug !== except; }).slice(0, limit);
      ul.innerHTML = R.listHtml(cfg, items, l, { heading: ul.getAttribute('data-heading') || 'h2', eager: !strip });
    });
    if (strip) strip.hidden = listItems.length === 0;
  }

  if (lists.length) {
    live().then(function (items) {
      listItems = items;
      renderLists();
    }).catch(function () { /* the built list (or the hidden strip) stands */ });
    /* the homepage swaps language in place (js/app.js) — the cards follow */
    document.addEventListener('langchange', renderLists);
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
    var setText = function (name, value) { var el = $(name); if (el) el.textContent = value; };

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
      var when = $('when');
      if (when) { when.textContent = R.whenText(item, l); when.setAttribute('datetime', R.keyDate(item)); }
      var anyFact = false;
      ['audience', 'bring'].forEach(function (f) {
        var v = R.text(item, f, l);
        anyFact = anyFact || Boolean(v);
        var row = $(f);
        if (!row) return;
        row.hidden = !v;
        var dd = row.querySelector('dd');
        if (dd) dd.textContent = v;
      });
      var facts = $('facts');
      if (facts) facts.hidden = !anyFact;
      var body = $('body');
      if (body) body.innerHTML = R.paragraphsHtml(R.text(item, 'body', l));
      var gallery = $('gallery');
      if (gallery) {
        gallery.innerHTML = R.galleryHtml(cfg, item, l);
        gallery.parentElement.hidden = !(item.image_paths || []).length;
      }
      var hero = $('cover');
      if (hero) hero.src = R.cover(cfg, item);
      $$('cta').forEach(function (a) { a.href = R.ctaHref(item, l); });
      $$('share-wa').forEach(function (a) { a.href = R.shareWaHref(item, l, absolute); });
      document.body.setAttribute('data-hp-title', R.text(item, 'title', l));
    }

    live().then(function (items) {
      var mine = items.filter(function (it) { return it.slug === slug; })[0];
      var others = items.filter(function (it) { return it.slug !== slug; }).slice(0, 3);
      var next = $('next');
      if (next) next.innerHTML = R.listHtml(cfg, others, l, { heading: 'h3' });
      if (mine) {
        refresh(mine);
        setState('live');
        return;
      }
      return view('passed', 'select=*&slug=eq.' + encodeURIComponent(slug)).then(function (rows) {
        if (rows[0]) { refresh(rows[0]); setState('passed'); }
        else setState('unavailable'); /* unpublished since the last rebuild — never "passed", which would be untrue */
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

    /* the CTA: a wa.me link to the venue's number, never the share link */
    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest && e.target.closest('a[href*="wa.me/' + R.PHONE + '"]');
      if (!link || !track) return;
      track.whatsappClick({ source: link.getAttribute('data-bizevent-source') || 'happening', lang: l });
    });
  }
})();

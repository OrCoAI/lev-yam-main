'use strict';

/* ── Shared WhatsApp-CTA analytics ──────────────────────────────────────────
   Loaded by the marketing home (before js/app.js) and by every /stories/ page
   (before js/stories.js). One click, three vendors with deliberately different
   scopes — see CLAUDE.md:

     Dynatrace  levyam.whatsapp_cta  full business event, source + language
     Meta Pixel Contact              lead conversion, feeds ad optimisation
     GA4        whatsapp_click       per-page event carrying page_slug

   GA4 Enhanced Measurement already logs an automatic outbound `click` on these
   same links. whatsapp_click sits next to it: it is named, it carries the slug,
   and it is the one marked as a key event in the GA4 UI.

   Every sender no-ops when its vendor script hasn't loaded (blocked, offline,
   consent tooling), so a missing vendor never breaks a CTA.                  */

window.LevYamTrack = (function () {
  function bizEvent(type, attrs) {
    if (window.dynatrace && typeof window.dynatrace.sendBizEvent === 'function') {
      window.dynatrace.sendBizEvent(type, attrs);
    }
  }

  function metaEvent(name, attrs) {
    if (typeof window.fbq === 'function') {
      window.fbq('track', name, attrs);
    }
  }

  function gaEvent(name, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  }

  /* One WhatsApp CTA click, fanned out to all three. `source` identifies which
     CTA; the page slug is read from <body data-page-slug> ('home', 'story-hub',
     or a story slug) so no caller has to thread it through. */
  function whatsappClick(opts) {
    var source = (opts && opts.source) || 'general';
    var lang   = (opts && opts.lang) || document.documentElement.lang || 'he';
    var slug   = document.body.getAttribute('data-page-slug') || 'unknown';

    bizEvent('levyam.whatsapp_cta', {
      'event.source':    source,
      'event.lang':      lang,
      'event.page_slug': slug
    });

    metaEvent('Contact', {
      content_name:     source,
      content_category: 'whatsapp_cta',
      locale:           lang
    });

    gaEvent('whatsapp_click', {
      page_slug: slug,
      source:    source,
      lang:      lang
    });
  }

  /* Delegated matcher for WhatsApp CTAs. Both consumers call this rather than
     repeating the selector — the homepage does more on the same click (service
     interest, contact intent), so each keeps its own handler body. */
  function onWhatsAppClick(handler) {
    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest && e.target.closest('a[href*="wa.me"]');
      if (link) handler(link);
    });
  }

  return {
    bizEvent:        bizEvent,
    whatsappClick:   whatsappClick,
    onWhatsAppClick: onWhatsAppClick
  };
})();

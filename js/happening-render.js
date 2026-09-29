/* ── "What's happening" — the shared renderer ────────────────────────────
   One implementation of every piece of item text and markup the public
   surface shows: the date line, the card, the prefilled WhatsApp message, the
   share text and the page URL. Loaded by the browser (the hubs, the landing
   pages and the homepage strip, through js/happening.js) AND by
   scripts/gen-happening.mjs at build time through Node's createRequire — so
   a card rendered at deploy and a card refreshed on load are the same card.

   UMD on purpose: a plain script in the browser (window.LevYamHappeningRender),
   CommonJS under Node. No dependencies, no DOM access, no fetch — pure
   functions of (config, item, lang). The one request it knows about (the feed
   view, its order and headers) it BUILDS for both callers, so the page
   rendered at deploy and the page refreshed on load read the same rows the
   same way. Everything interpolated into markup is escaped here; callers never
   build HTML from item text themselves.

   `item` is a row of events.feed / events.passed (58/59_events_*.sql):
   slug, title_he/ar, summary_he/ar, body_he/ar, audience_he/ar, bring_he/ar,
   image_paths (ordered, [0] = cover), story_slug, event_date, starts_at,
   ends_at, recur_weekdays (0 = Sunday), recur_until, next_date (feed) or
   last_date (passed).                                                       */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LevYamHappeningRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PHONE = '972506669138';
  var BUCKET_PATH = '/storage/v1/object/public/events-public/';
  /* An item without photos still needs a hero and a card image. */
  var FALLBACK_COVER = '/img/hero/hero-poster.jpg';
  /* events.feed as every reader takes it: soonest first, an item without a
     start time before the timed ones of the same day. */
  var FEED_QUERY = 'select=*&order=next_date.asc,starts_at.asc.nullsfirst';

  /* Per-language strings. Both are RTL; Arabic is the site's Levantine
     register (js/app.js). The CTA and share wording are the owner's
     (plan decisions table, Q6). */
  var L = {
    he: {
      weekdays: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
      dayWord: 'יום ',            /* "יום שבת" */
      every: 'כל',
      and: ' ו',
      next: 'הבא',
      until: 'עד',
      brand: 'לב ים',
      hubName: 'מה קורה',
      empty: 'אין אירועים קרובים כרגע — עקבו אחרינו, בקרוב יהיה.',
      cta: function (title, date) { return 'שלום, אשמח להגיע ל' + title + (date ? ' ב־' + date : ''); },
      base: '/happening/'
    },
    ar: {
      weekdays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
      dayWord: '',
      every: 'كل',
      and: ' و',
      next: 'الجاي',
      until: 'لحد',
      brand: 'ليف يام',
      hubName: 'شو في',
      empty: 'ما في فعاليات قريبة هلق — تابعونا، قريبًا بيصير.',
      cta: function (title, date) { return 'أهلًا، بحب أجي على ' + title + (date ? ' بتاريخ ' + date : ''); },
      base: '/happening/ar/'
    }
  };

  function labels(lang) {
    if (!L[lang]) throw new Error('happening-render: unknown language ' + String(lang));
    return L[lang];
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* The item's own text in the page language; the other language is only a
     fallback for a draft the DB would not let become public anyway. */
  function text(item, field, lang) {
    labels(lang); // a non-code (the row, an object) must fail here, not fall back to one language
    var other = lang === 'ar' ? 'he' : 'ar';
    return (item[field + '_' + lang] || item[field + '_' + other] || '').trim();
  }

  /* The platform project's origin, however cfg.url was written. */
  function origin(cfg) { return cfg.url.replace(/\/+$/, ''); }

  /* A PostgREST read of one public view (events.feed / events.passed) with
     the publishable key — the URL and headers only; the caller fetches. */
  function viewRequest(cfg, view, query) {
    return {
      url: origin(cfg) + '/rest/v1/' + view + '?' + query,
      headers: { apikey: cfg.key, 'Accept-Profile': 'events', Accept: 'application/json' }
    };
  }

  /* A gallery path is `<uuid>/<name>.jpg` inside the public bucket
     (events_image_paths_valid). An absolute path (/img/…, the build fixture)
     is served as-is. */
  function imageUrl(cfg, path) {
    if (/^(https?:)?\//.test(path)) return path;
    return origin(cfg) + BUCKET_PATH + path;
  }

  function cover(cfg, item) {
    var paths = item.image_paths || [];
    return paths.length ? imageUrl(cfg, paths[0]) : FALLBACK_COVER;
  }

  /* ISO date → DD.MM.YYYY / DD.MM; locale-independent so build and browser agree. */
  function ymd(iso) { return /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); }
  function displayDate(iso) {
    var m = ymd(iso);
    return m ? m[3] + '.' + m[2] + '.' + m[1] : (iso || '');
  }
  function shortDate(iso) {
    var m = ymd(iso);
    return m ? m[3] + '.' + m[2] : (iso || '');
  }
  /* Noon UTC: the calendar day never shifts, whatever the machine's zone. */
  function weekdayOf(iso) {
    return new Date(iso + 'T12:00:00Z').getUTCDay();
  }
  function weekdayName(iso, lang) {
    return labels(lang).weekdays[weekdayOf(iso)];
  }
  /* "יום שבת 04.10" / "السبت 04.10" — a card's date and a recurring item's next one. */
  function dayShort(iso, lang) {
    return labels(lang).dayWord + weekdayName(iso, lang) + ' ' + shortDate(iso);
  }

  function hhmm(t) { return t ? String(t).slice(0, 5) : ''; }
  function hours(item) {
    var a = hhmm(item.starts_at), b = hhmm(item.ends_at);
    return a && b ? a + '–' + b : a || b || '';
  }

  /* "שישי ושבת" / "الجمعة والسبت" — the last two joined with "and". */
  function joinDays(days, lang) {
    var l = labels(lang);
    var names = days.slice().sort(function (a, b) { return a - b; }).map(function (d) { return l.weekdays[d]; });
    if (names.length <= 1) return names.join('');
    return names.slice(0, -1).join(', ') + l.and + names[names.length - 1];
  }

  function isRecurring(item) { return Array.isArray(item.recur_weekdays) && item.recur_weekdays.length > 0; }

  /* The date the CTA and the hero name: the next occurrence, or the item's
     own date (a passed item keeps its date). */
  function keyDate(item) { return item.next_date || item.event_date || ''; }

  /* The full "when" line of a landing page. */
  function whenText(item, lang) {
    var l = labels(lang);
    var parts = [];
    if (isRecurring(item)) {
      parts.push(l.every + ' ' + joinDays(item.recur_weekdays, lang));
      if (hours(item)) parts.push(hours(item));
      if (item.next_date) parts.push(l.next + ': ' + dayShort(item.next_date, lang));
      if (item.recur_until) parts.push(l.until + ' ' + displayDate(item.recur_until));
    } else {
      var d = keyDate(item);
      parts.push(d ? l.dayWord + weekdayName(d, lang) + ', ' + displayDate(d) : '');
      if (hours(item)) parts.push(hours(item));
    }
    return parts.filter(Boolean).join(' · ');
  }

  /* The card's shorter line. */
  function whenShort(item, lang) {
    var l = labels(lang);
    var parts = [];
    if (isRecurring(item)) parts.push(l.every + ' ' + joinDays(item.recur_weekdays, lang));
    else if (keyDate(item)) parts.push(dayShort(keyDate(item), lang));
    if (hhmm(item.starts_at)) parts.push(hhmm(item.starts_at));
    return parts.join(' · ');
  }

  function pageUrl(item, lang) { return labels(lang).base + item.slug + '/'; }

  /* The date is the NEXT occurrence only: a passed item keeps its CTA (plan Q8)
     but must not ask to come on a date that is over. */
  function ctaText(item, lang) {
    var d = item.next_date;
    return labels(lang).cta(text(item, 'title', lang), d ? displayDate(d) : '');
  }
  function ctaHref(item, lang) {
    return 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(ctaText(item, lang));
  }

  function shareText(item, lang, absoluteUrl) {
    return text(item, 'title', lang) + ' · ' + labels(lang).brand + ' · ' + absoluteUrl;
  }
  /* wa.me without a number opens the contact picker — a share, not a message to us. */
  function shareWaHref(item, lang, absoluteUrl) {
    return 'https://wa.me/?text=' + encodeURIComponent(shareText(item, lang, absoluteUrl));
  }

  /* One card. `opts.heading` is the heading level (h2 on a hub, h3 inside a
     page section); `opts.eager` marks the first, above-the-fold card.
     alt="" on purpose: the visible title is the card's accessible name. */
  function cardHtml(cfg, item, lang, opts) {
    opts = opts || {};
    var h = opts.heading || 'h2';
    return '<li>' +
      '<a class="hp-card" href="' + escapeHtml(pageUrl(item, lang)) + '">' +
        '<div class="hp-card-media"><img src="' + escapeHtml(cover(cfg, item)) + '" alt="" width="1200" height="900" decoding="async"' +
          (opts.eager ? ' fetchpriority="high"' : ' loading="lazy"') + '></div>' +
        '<div class="hp-card-body">' +
          '<' + h + ' class="hp-card-title">' + escapeHtml(text(item, 'title', lang)) + '</' + h + '>' +
          '<p class="hp-card-desc">' + escapeHtml(text(item, 'summary', lang)) + '</p>' +
          '<time class="hp-card-date" datetime="' + escapeHtml(keyDate(item)) + '">' + escapeHtml(whenShort(item, lang)) + '</time>' +
        '</div>' +
      '</a>' +
    '</li>';
  }

  /* The <li>s of a list; the empty state when there is nothing live. */
  function listHtml(cfg, items, lang, opts) {
    opts = opts || {};
    if (!items.length) return '<li class="hp-grid-empty"><p>' + escapeHtml(labels(lang).empty) + '</p></li>';
    return items.map(function (item, i) {
      return cardHtml(cfg, item, lang, { heading: opts.heading, eager: opts.eager && i === 0 });
    }).join('\n');
  }

  /* Body text → paragraphs (blank-line or newline separated), escaped. */
  function paragraphsHtml(body) {
    return String(body || '').split(/\n\s*\n|\n/).map(function (p) { return p.trim(); }).filter(Boolean)
      .map(function (p) { return '<p>' + escapeHtml(p) + '</p>'; }).join('\n');
  }

  function galleryHtml(cfg, item, lang) {
    var paths = item.image_paths || [];
    if (!paths.length) return '';
    var title = text(item, 'title', lang);
    return paths.map(function (p, i) {
      return '<figure class="hp-gallery-item"><img src="' + escapeHtml(imageUrl(cfg, p)) + '" alt="' +
        escapeHtml(title + ' — ' + (i + 1)) + '" loading="lazy" decoding="async" width="1600" height="1200"></figure>';
    }).join('\n');
  }

  return {
    PHONE: PHONE,
    FALLBACK_COVER: FALLBACK_COVER,
    FEED_QUERY: FEED_QUERY,
    viewRequest: viewRequest,
    labels: labels,
    escapeHtml: escapeHtml,
    text: text,
    imageUrl: imageUrl,
    cover: cover,
    displayDate: displayDate,
    weekdayName: weekdayName,
    hours: hours,
    isRecurring: isRecurring,
    keyDate: keyDate,
    whenText: whenText,
    whenShort: whenShort,
    pageUrl: pageUrl,
    ctaText: ctaText,
    ctaHref: ctaHref,
    shareText: shareText,
    shareWaHref: shareWaHref,
    cardHtml: cardHtml,
    listHtml: listHtml,
    paragraphsHtml: paragraphsHtml,
    galleryHtml: galleryHtml
  };
});

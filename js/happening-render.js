/* ── "What's happening" — the shared renderer ────────────────────────────
   One implementation of every piece of item text and markup the public
   surface shows: the date line, the card, the prefilled WhatsApp message, the
   share text and the page URL. Loaded by the browser (the hubs and the landing
   pages, through js/happening.js) AND by
   scripts/gen-happening.mjs at build time through Node's createRequire — so
   a card rendered at deploy and a card refreshed on load are the same card.

   UMD on purpose: a plain script in the browser (window.LevYamHappeningRender),
   CommonJS under Node. No dependencies, no DOM access, no fetch — pure
   functions of (config, item, lang). The one request it knows about (the feed
   view, its order and headers) it BUILDS for both callers, so the page
   rendered at deploy and the page refreshed on load read the same rows the
   same way. Everything interpolated into markup is escaped here; callers never
   build HTML from item text themselves.

   `item` is a row of events.feed / events.passed (58–60_events_*.sql):
   slug, title_he/ar, summary_he/ar, body_he/ar, audience_he/ar, bring_he/ar,
   cost_he/ar, booking_required, image_paths (ordered, [0] = cover),
   event_date, starts_at, ends_at, recur_weekdays (0 = Sunday), recur_until,
   next_date (feed) or last_date (passed). The build may add small_copy:
   false — it checked, and the cover has no -sm.jpg copy (coverThumb).      */
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
     start time before the timed ones of the same day. FEED_QUERY is the whole
     row (the build, and a landing page's own item); LIST_QUERY is what a card,
     the calendar and "more initiatives" read — no long texts, so a hub with a
     hundred items stays a small download. */
  var FEED_ORDER = 'order=next_date.asc,starts_at.asc.nullsfirst,slug.asc'; /* slug: a fixed order for ties, build and browser alike */
  var FEED_QUERY = 'select=*&' + FEED_ORDER;
  var LIST_QUERY = 'select=slug,title_he,title_ar,summary_he,summary_ar,image_paths,' +
    'event_date,starts_at,ends_at,recur_weekdays,recur_until,next_date&' + FEED_ORDER;

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
      brand: 'לב ים',
      hubName: 'יוזמות',
      photos: 'תמונות',
      prevPhoto: 'התמונה הקודמת',
      nextPhoto: 'התמונה הבאה',
      photoN: function (n) { return 'תמונה ' + n; },
      bookingRequired: 'הרשמה מראש בוואטסאפ',
      bookingNone: 'ללא הרשמה מראש',
      months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
      dow: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
      calPrev: 'חודש קודם',
      calNext: 'חודש הבא',
      calEmpty: 'אין יוזמות בחודש הזה.',
      toPage: 'לעמוד היוזמה',
      empty: 'אין יוזמות קרובות כרגע — עקבו אחרינו, בקרוב יהיה.',
      emptyMore: 'אין כרגע יוזמות נוספות — עקבו אחרינו, בקרוב יהיה.',
      showMore: 'הצג עוד יוזמות',
      dayCount: function (n) { return n + ' יוזמות'; },
      cta: function (title, date) { return 'שלום, אשמח להגיע ל' + title + (date ? ' ב־' + date : ''); },
      base: '/happening/'
    },
    ar: {
      weekdays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
      dayWord: '',
      every: 'كل',
      and: ' و',
      next: 'الجاي',
      brand: 'ليف يام',
      hubName: 'مبادرات',
      photos: 'صور',
      prevPhoto: 'الصورة السابقة',
      nextPhoto: 'الصورة الجاية',
      photoN: function (n) { return 'صورة ' + n; },
      bookingRequired: 'التسجيل المسبق عالواتساب',
      bookingNone: 'بدون تسجيل مسبق',
      months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
      dow: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
      calPrev: 'الشهر السابق',
      calNext: 'الشهر الجاي',
      calEmpty: 'ما في مبادرات بهالشهر.',
      toPage: 'لصفحة المبادرة',
      empty: 'ما في مبادرات قريبة هلق — تابعونا، قريبًا بيصير.',
      emptyMore: 'ما في مبادرات تانية هلق — تابعونا، قريبًا بيصير.',
      showMore: 'شوفوا مبادرات كمان',
      dayCount: function (n) { return n === 2 ? 'مبادرتين' : n <= 10 ? n + ' مبادرات' : n + ' مبادرة'; }, /* dual; plural 3–10; singular from 11 */
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
  function isSitePath(path) { return /^(https?:)?\//.test(path); }
  function imageUrl(cfg, path) {
    return isSitePath(path) ? path : origin(cfg) + BUCKET_PATH + path;
  }

  function cover(cfg, item) {
    var paths = item.image_paths || [];
    return paths.length ? imageUrl(cfg, paths[0]) : FALLBACK_COVER;
  }

  /* Every uploaded photo has a small copy beside it, `<name>-sm.jpg`, ~800px
     (the upload in app-src/src/modules/events/api.ts writes both): the one a
     card, the calendar and a link preview use. A site path (the fixture, the
     fallback cover) has no copy and is used as it is. Photos uploaded before
     the copies existed have none — a card's <img> carries data-full, and
     js/happening.js swaps to it when the small one fails to load. */
  function thumbPath(path) {
    return isSitePath(path) ? path : path.replace(/\.[a-z0-9]+$/i, '') + '-sm.jpg';
  }
  function coverThumb(cfg, item) {
    var paths = item.image_paths || [];
    if (!paths.length) return FALLBACK_COVER;
    /* the build checked and found no copy (scripts/gen-happening.mjs sets
       small_copy: false): the page as built names the full photo directly */
    return imageUrl(cfg, item.small_copy === false ? paths[0] : thumbPath(paths[0]));
  }
  /* src + data-full for a small image; data-full only when it differs. */
  function thumbAttrs(cfg, item) {
    var small = coverThumb(cfg, item), full = cover(cfg, item);
    return 'src="' + escapeHtml(small) + '"' + (small !== full ? ' data-full="' + escapeHtml(full) + '"' : '');
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
  /* "09:00–11:00", held left-to-right: in an RTL line the en dash (a bidi
     neutral) would split the range and show it as "11:00–09:00". The
     isolate marks (LRI … PDI) are invisible and work in plain text too — a
     tile's textContent, an aria-label. */
  function hours(item) {
    var a = hhmm(item.starts_at), b = hhmm(item.ends_at);
    return a && b ? '\u2066' + a + '–' + b + '\u2069' : a || b || '';
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

  /* A landing page's "when", two lines: the pattern or the date, then the
     hours. The "when" tile shows them as they are; the hero wraps them in
     markup and adds a recurring item's next date (whenHeroHtml). A recurring
     item's end date is not shown (owner, 2026-09-30) — the calendar and the
     next date already stop where it stops. */
  function whenLines(item, lang) {
    var l = labels(lang);
    if (isRecurring(item)) return [l.every + ' ' + joinDays(item.recur_weekdays, lang), hours(item)];
    var d = keyDate(item);
    return [d ? l.dayWord + weekdayName(d, lang) + ', ' + displayDate(d) : '', hours(item)];
  }

  /* The hero's "when", as markup: the date (or pattern) and the hours on one
     line, each piece unbreakable so a narrow screen wraps between them, never
     inside a date; a recurring item's next date on a line of its own. */
  function whenHeroHtml(item, lang) {
    var l = labels(lang);
    var date = !isRecurring(item) && keyDate(item);
    var main = whenLines(item, lang).filter(Boolean).map(function (p, i) {
      var piece = escapeHtml(p);
      if (i === 0 && date) piece = '<time datetime="' + escapeHtml(date) + '">' + piece + '</time>';
      /* a long weekday pattern ("every Sun, Mon, … and Sat") may wrap; a date and the hours never */
      return '<span class="hp-when-part' + (i === 0 && isRecurring(item) ? ' hp-when-pattern' : '') + '">' + piece + '</span>';
    }).join('');
    var next = isRecurring(item) && item.next_date
      ? '<span class="hp-when-next">' + escapeHtml(l.next) + ': <time datetime="' + escapeHtml(item.next_date) + '">' +
        escapeHtml(dayShort(item.next_date, lang)) + '</time></span>'
      : '';
    return '<span class="hp-when-main">' + main + '</span>' + next;
  }

  /* The cost tile's fixed second line (60_events_cost: booking_required). */
  function bookingText(item, lang) {
    var l = labels(lang);
    return item.booking_required ? l.bookingRequired : l.bookingNone;
  }
  /* The tile shows when there is a cost line or a booking to mention. */
  function hasCost(item, lang) { return Boolean(item.booking_required) || Boolean(text(item, 'cost', lang)); }

  /* The fact tiles sit in two columns; with an odd count the last one shown
     spans both. The name of that tile ('cost' | 'audience' | 'bring') or
     null — "when" and "where" always show, so neither is ever the odd one. */
  function wideFact(item, lang) {
    var shown = ['when', 'where'];
    if (hasCost(item, lang)) shown.push('cost');
    if (text(item, 'audience', lang)) shown.push('audience');
    if (text(item, 'bring', lang)) shown.push('bring');
    return shown.length % 2 ? shown[shown.length - 1] : null;
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
        '<div class="hp-card-media"><img ' + thumbAttrs(cfg, item) + ' alt="" width="800" height="600" decoding="async"' +
          (opts.eager ? ' fetchpriority="high"' : ' loading="lazy"') + '></div>' +
        '<div class="hp-card-body">' +
          '<' + h + ' class="hp-card-title">' + escapeHtml(text(item, 'title', lang)) + '</' + h + '>' +
          '<p class="hp-card-desc">' + escapeHtml(text(item, 'summary', lang)) + '</p>' +
          '<time class="hp-card-date" datetime="' + escapeHtml(keyDate(item)) + '">' + escapeHtml(whenShort(item, lang)) + '</time>' +
        '</div>' +
      '</a>' +
    '</li>';
  }

  /* The <li>s of a list; the empty state when there is nothing live. `more`
     words it for an item page's "more initiatives" row: "no other ones",
     since "none upcoming" reads wrong under an upcoming item's own page. */
  function listHtml(cfg, items, lang, opts) {
    opts = opts || {};
    var l = labels(lang);
    if (!items.length) return '<li class="hp-grid-empty"><p>' + escapeHtml(opts.more ? l.emptyMore : l.empty) + '</p></li>';
    return items.map(function (item, i) {
      return cardHtml(cfg, item, lang, { heading: opts.heading, eager: opts.eager && i === 0 });
    }).join('\n');
  }

  /* The item page's "more initiatives": the one-off initiatives nearest in
     date to this one, then weekly ones only to fill the row — ordered by
     next date, a weekly item is always days away and would otherwise take the
     same three places on every page. Shown soonest first. A pure function of
     the feed, so the page built at deploy and the page refreshed on load pick
     the same three. */
  function dayNum(iso) { var m = ymd(iso); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : 0; }
  function byDate(a, b) { var x = keyDate(a), y = keyDate(b); return x < y ? -1 : x > y ? 1 : 0; }
  function moreItems(items, current, n) {
    var ref = dayNum(current.next_date || current.last_date || current.event_date);
    var gap = function (it) { return Math.abs(dayNum(keyDate(it)) - ref); };
    var near = function (a, b) { return gap(a) - gap(b) || byDate(a, b); };
    var others = items.filter(function (it) { return it.slug !== current.slug; });
    var picked = others.filter(function (it) { return !isRecurring(it); }).sort(near).slice(0, n);
    if (picked.length < n) picked = picked.concat(others.filter(isRecurring).sort(near).slice(0, n - picked.length));
    return picked.sort(byDate);
  }

  /* Body text → paragraphs (blank-line or newline separated), escaped. */
  function paragraphsHtml(body) {
    return String(body || '').split(/\n\s*\n|\n/).map(function (p) { return p.trim(); }).filter(Boolean)
      .map(function (p) { return '<p>' + escapeHtml(p) + '</p>'; }).join('\n');
  }

  /* Both languages are RTL, so "previous" sits at the inline start (right)
     and points right; "next" sits at the inline end and points left. */
  var CHEVRON_PREV = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
  var CHEVRON_NEXT = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';

  /* The photos: one framed photo, or the slideshow js/happening.js runs — the
     slides stacked, arrows, a dot per photo and a counter. The first slide
     starts active so the page reads right before (and without) JavaScript. */
  function galleryHtml(cfg, item, lang) {
    var paths = item.image_paths || [];
    if (!paths.length) return '';
    var l = labels(lang);
    var title = text(item, 'title', lang);
    var n = paths.length;
    var slides = paths.map(function (p, i) {
      return '<figure class="hp-slide' + (i === 0 ? ' is-active' : '') + '"><img src="' + escapeHtml(imageUrl(cfg, p)) + '" alt="' +
        escapeHtml(title + ' — ' + (i + 1)) + '"' + (i === 0 ? '' : ' loading="lazy"') + ' decoding="async" width="1600" height="1200"></figure>';
    }).join('');
    if (n === 1) return '<div class="hp-slides">' + slides + '</div>';
    var dots = paths.map(function (_, i) {
      return '<button type="button" class="hp-slide-dot' + (i === 0 ? ' is-active' : '') + '" data-slide-to="' + i + '" aria-label="' +
        escapeHtml(l.photoN(i + 1)) + '"' + (i === 0 ? ' aria-current="true"' : '') + '></button>';
    }).join('');
    return '<div class="hp-slides" data-slides role="group" aria-roledescription="carousel" aria-label="' + escapeHtml(l.photos) + '" tabindex="0">' +
      slides +
      '<button type="button" class="hp-slide-arrow" data-slide-step="-1" aria-label="' + escapeHtml(l.prevPhoto) + '">' + CHEVRON_PREV + '</button>' +
      '<button type="button" class="hp-slide-arrow" data-slide-step="1" aria-label="' + escapeHtml(l.nextPhoto) + '">' + CHEVRON_NEXT + '</button>' +
      '<div class="hp-slide-dots">' + dots + '</div>' +
      '<span class="hp-slide-count" data-slide-count aria-hidden="true">1 / ' + n + '</span>' +
    '</div>';
  }

  /* ── The hub's calendar: pure date maths + markup; js/happening.js holds
     the month and the selected day and re-renders on every click. All dates
     are ISO strings handled at noon UTC (weekdayOf), so the machine's zone
     never moves a day. A recurring item is expanded day by day inside the
     month; nothing before `today` is marked (the feed only carries live
     items, and a day that passed is not an invitation). ── */
  function toDate(iso) { return new Date(iso + 'T12:00:00Z'); }
  function toIso(d) { return d.toISOString().slice(0, 10); }
  function addDays(iso, n) { var d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function monthStart(year, month) { return year + '-' + pad2(month + 1) + '-01'; }
  function monthEnd(year, month) { return toIso(new Date(Date.UTC(year, month + 1, 0, 12))); }

  /* The dates an item happens on within [from, to] (ISO, inclusive). */
  function occurrences(item, from, to) {
    var out = [];
    if (isRecurring(item)) {
      var start = item.event_date > from ? item.event_date : from;
      var end = item.recur_until && item.recur_until < to ? item.recur_until : to;
      for (var d = start; d <= end; d = addDays(d, 1)) {
        if (item.recur_weekdays.indexOf(weekdayOf(d)) !== -1) out.push(d);
      }
    } else if (item.event_date && item.event_date >= from && item.event_date <= to) {
      out.push(item.event_date);
    }
    return out;
  }

  /* { 'YYYY-MM-DD': [item, …] } for one month, from `today` on. */
  function monthIndex(items, year, month, today) {
    var first = monthStart(year, month), last = monthEnd(year, month);
    var from = today > first ? today : first;
    var map = {};
    if (from > last) return map;
    items.forEach(function (item) {
      occurrences(item, from, last).forEach(function (d) { (map[d] = map[d] || []).push(item); });
    });
    /* a day's items by time of day, an untimed one first — the feed's own order */
    var t = function (item) { return item.starts_at || ''; };
    Object.keys(map).forEach(function (d) {
      map[d].sort(function (a, b) { return t(a) < t(b) ? -1 : t(a) > t(b) ? 1 : 0; });
    });
    return map;
  }

  /* The month: a header with the two arrows, the weekday letters, the days.
     A marked day is a button (aria-pressed = selected); the rest are plain. */
  function calendarHtml(items, lang, year, month, selected, today) {
    var l = labels(lang);
    var index = monthIndex(items, year, month, today);
    var daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    var cells = '';
    for (var b = weekdayOf(monthStart(year, month)); b > 0; b--) cells += '<span class="hp-cal-day is-blank" aria-hidden="true"></span>';
    for (var n = 1; n <= daysIn; n++) {
      var iso = year + '-' + pad2(month + 1) + '-' + pad2(n);
      var mine = index[iso] || [];
      var cls = 'hp-cal-day' + (iso === today ? ' is-today' : '') + (iso < today ? ' is-past' : '') + (iso === selected ? ' is-selected' : '');
      if (mine.length) {
        /* up to three dots; a busier day shows two and "+N" for the rest.
           The label names every item — the dots are only a hint. */
        var names = mine.map(function (it) { return text(it, 'title', lang); }).join(', ');
        var count = mine.length > 1 ? l.dayCount(mine.length) + ': ' : '';
        var marks = mine.length > 3
          ? '<i></i><i></i><b class="hp-cal-more">+' + (mine.length - 2) + '</b>'
          : mine.map(function () { return '<i></i>'; }).join('');
        cells += '<button type="button" class="' + cls + '" data-cal-day="' + iso + '" aria-pressed="' + (iso === selected) + '" aria-label="' +
          escapeHtml(l.dayWord + weekdayName(iso, lang) + ' ' + displayDate(iso) + ', ' + count + names) + '">' +
          '<span class="hp-cal-num">' + n + '</span><span class="hp-cal-dots" aria-hidden="true">' + marks + '</span></button>';
      } else {
        cells += '<span class="' + cls + '"><span class="hp-cal-num">' + n + '</span></span>';
      }
    }
    var atCurrent = monthStart(year, month) <= today;
    return '<div class="hp-cal-head">' +
        '<button type="button" class="hp-cal-nav" data-cal-step="-1" aria-label="' + escapeHtml(l.calPrev) + '"' + (atCurrent ? ' disabled' : '') + '>' + CHEVRON_PREV + '</button>' +
        '<h2 class="hp-cal-title">' + escapeHtml(l.months[month] + ' ' + year) + '</h2>' +
        '<button type="button" class="hp-cal-nav" data-cal-step="1" aria-label="' + escapeHtml(l.calNext) + '">' + CHEVRON_NEXT + '</button>' +
      '</div>' +
      '<div class="hp-cal-grid">' +
        l.dow.map(function (d) { return '<span class="hp-cal-dow">' + d + '</span>'; }).join('') + cells +
      '</div>';
  }

  /* The selected day's items beside (or under) the month, or a one-line note. */
  function dayPanelHtml(cfg, items, lang, iso) {
    var l = labels(lang);
    if (!iso) return '<p class="hp-cal-note">' + escapeHtml(l.calEmpty) + '</p>';
    return '<h3 class="hp-cal-day-title">' + escapeHtml(l.dayWord + weekdayName(iso, lang) + ', ' + displayDate(iso)) + '</h3>' +
      '<ul class="hp-cal-list">' + items.map(function (item) {
        return '<li><a class="hp-cal-item" href="' + escapeHtml(pageUrl(item, lang)) + '">' +
          '<img ' + thumbAttrs(cfg, item) + ' alt="" width="120" height="90" loading="lazy" decoding="async">' +
          '<span class="hp-cal-item-body">' +
            '<strong>' + escapeHtml(text(item, 'title', lang)) + '</strong>' +
            (hours(item) ? '<span class="hp-cal-item-time">' + escapeHtml(hours(item)) + '</span>' : '') +
            '<span class="hp-cal-item-desc">' + escapeHtml(text(item, 'summary', lang)) + '</span>' +
            '<span class="hp-cal-item-go">' + escapeHtml(l.toPage) + ' ←</span>' +
          '</span></a></li>';
      }).join('') + '</ul>';
  }

  return {
    PHONE: PHONE,
    FALLBACK_COVER: FALLBACK_COVER,
    FEED_QUERY: FEED_QUERY,
    LIST_QUERY: LIST_QUERY,
    viewRequest: viewRequest,
    labels: labels,
    escapeHtml: escapeHtml,
    text: text,
    imageUrl: imageUrl,
    cover: cover,
    thumbPath: thumbPath,
    coverThumb: coverThumb,
    displayDate: displayDate,
    weekdayName: weekdayName,
    hours: hours,
    isRecurring: isRecurring,
    keyDate: keyDate,
    whenHeroHtml: whenHeroHtml,
    whenLines: whenLines,
    whenShort: whenShort,
    bookingText: bookingText,
    hasCost: hasCost,
    wideFact: wideFact,
    occurrences: occurrences,
    monthIndex: monthIndex,
    calendarHtml: calendarHtml,
    dayPanelHtml: dayPanelHtml,
    pageUrl: pageUrl,
    ctaText: ctaText,
    ctaHref: ctaHref,
    shareText: shareText,
    shareWaHref: shareWaHref,
    cardHtml: cardHtml,
    listHtml: listHtml,
    moreItems: moreItems,
    paragraphsHtml: paragraphsHtml,
    galleryHtml: galleryHtml
  };
});

'use strict';

/* ── Meta Pixel + GA4 bootstrap, shared by every page ───────────────────────
   Loaded once per page, before js/wa-track.js. Lives here rather than inline so
   the Pixel ID and the GA4 measurement ID exist in ONE place — inline, they were
   on their way to nine HTML files and growing by two per story page pair, with a
   missed file silently losing conversion tracking and nothing failing.

   Not here, deliberately:
     · the Dynatrace RUM tag — one <script src> line, wants to run synchronously
       in <head> for full session coverage;
     · the Meta <noscript> pixel <img> — must stay inline markup to work at all.

   Both vendors load their own heavy JS asynchronously, so this file is a small
   bootstrap. Its <script> tag is async, not defer: nothing here touches the
   DOM being parsed, and async fires the PageView as soon as the file arrives
   instead of waiting for the full document parse — visitors who bounce during
   parse on slow connections still get counted.                               */

/* Meta Pixel */
(function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
  t = b.createElement(e); t.async = !0; t.src = v;
  s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);
})(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

window.fbq('init', '3961552923978842');
window.fbq('track', 'PageView');

/* Google Analytics 4 */
(function () {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-VWL45MKK76';
  document.head.appendChild(s);
})();

window.dataLayer = window.dataLayer || [];
window.gtag = function () { window.dataLayer.push(arguments); };
window.gtag('js', new Date());
window.gtag('config', 'G-VWL45MKK76');

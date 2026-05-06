'use strict';


/* ── Mobile menu toggle ───────────────────────────────────────────────── */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (!toggle || !mobileNav) return;

  function closeMenu() {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'פתיחת תפריט');
    mobileNav.hidden = true;
  }

  toggle.addEventListener('click', function () {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeMenu();
    } else {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'סגירת תפריט');
      mobileNav.hidden = false;
    }
  });

  // Close button inside the nav
  var btnClose = mobileNav.querySelector('.mobile-nav-close');
  if (btnClose) {
    btnClose.addEventListener('click', function () { closeMenu(); toggle.focus(); });
  }

  // Close when a nav link is clicked
  mobileNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });
})();

/* ── Section reveals (IntersectionObserver, fires once) ──────────────── */
(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealEls.forEach(function (el) {
    observer.observe(el);
  });
})();

/* ── Gallery lightbox ─────────────────────────────────────────────────── */
(function () {
  const lightbox  = document.getElementById('lightbox');
  const lightImg  = lightbox && lightbox.querySelector('.lightbox-img');
  const btnClose  = lightbox && lightbox.querySelector('.lightbox-close');
  const btnPrev   = lightbox && lightbox.querySelector('.lightbox-prev');
  const btnNext   = lightbox && lightbox.querySelector('.lightbox-next');
  const items     = Array.from(document.querySelectorAll('.gallery-item'));

  if (!lightbox || !items.length) return;

  let currentIndex = 0;
  let lastTrigger  = null;

  function open(index) {
    currentIndex = index;
    const item   = items[index];
    const src    = item.dataset.full || '';
    const label  = item.getAttribute('aria-label') || '';

    lightImg.src = src;
    lightImg.alt = label.replace('פתח תמונה ', 'תמונה ');

    lightbox.showModal();
    btnClose.focus();
  }

  function close() {
    lightbox.close();
    lightImg.src = '';
    if (lastTrigger) lastTrigger.focus();
  }

  function navigate(direction) {
    currentIndex = (currentIndex + direction + items.length) % items.length;
    const item   = items[currentIndex];
    lightImg.src = item.dataset.full || '';
    lightImg.alt = (item.getAttribute('aria-label') || '').replace('פתח תמונה ', 'תמונה ');
  }

  items.forEach(function (item, i) {
    item.addEventListener('click', function () {
      lastTrigger = item;
      open(i);
    });
  });

  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', function () { navigate(-1); });
  btnNext.addEventListener('click', function () { navigate(1); });

  // Close on backdrop click
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) close();
  });

  // Keyboard navigation
  lightbox.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   navigate(-1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown')  navigate(1);
  });

  // Touch swipe
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener('touchend', function (e) {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) navigate(diff > 0 ? 1 : -1);
  }, { passive: true });
})();

/* ── Lev Yam map (Leaflet + CARTO tiles, lazy-loaded) ─────────────────── */
(function () {
  const frame = document.querySelector('.map-frame');
  const canvas = document.getElementById('lev-yam-map');
  if (!frame || !canvas) return;

  const lat = parseFloat(frame.dataset.lat);
  const lng = parseFloat(frame.dataset.lng);
  const ctaLink = frame.querySelector('.map-cta');
  const mapUrl = ctaLink ? ctaLink.href : '';
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const PIN_SVG =
    '<svg viewBox="0 0 24 32" class="lym-pin" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="lymPinGrad" x1="0.5" y1="0" x2="0.5" y2="1">' +
          '<stop offset="0%" stop-color="#f8a94f"/>' +
          '<stop offset="100%" stop-color="#d97f1f"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M12 0 C5.4 0 0 5.4 0 12 c0 9 12 20 12 20 s12-11 12-20 C24 5.4 18.6 0 12 0z" ' +
            'fill="url(#lymPinGrad)" stroke="#a86214" stroke-width="0.7"/>' +
      '<circle cx="12" cy="12" r="4.2" fill="#fff7ea" stroke="#d97f1f" stroke-width="0.6"/>' +
    '</svg>';

  const LEAFLET_VERSION = '1.9.4';
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@' + LEAFLET_VERSION + '/dist/leaflet.css';
  const LEAFLET_JS  = 'https://unpkg.com/leaflet@' + LEAFLET_VERSION + '/dist/leaflet.js';

  let loadingPromise = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (loadingPromise) return loadingPromise;

    loadingPromise = new Promise(function (resolve, reject) {
      // Inject CSS
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS;
        link.dataset.leaflet = '1';
        document.head.appendChild(link);
      }
      // Inject JS
      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.onload = function () { resolve(window.L); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return loadingPromise;
  }

  function buildMap(L) {
    if (canvas.dataset.mapInit === '1') return;
    canvas.dataset.mapInit = '1';

    const map = L.map(canvas, {
      center: [lat, lng],
      zoom: 15,
      minZoom: 8,
      maxZoom: 16,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    });

    // Israel Hiking Map (Hebrew) — free, no API key, Hebrew labels (attribution required)
    L.tileLayer('https://israelhiking.osm.org.il/Hebrew/Tiles/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://israelhiking.osm.org.il" target="_blank" rel="noopener">Israel Hiking Map</a> · &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 16,
    }).addTo(map);

    const icon = L.divIcon({
      className: 'lev-yam-marker',
      html:
        '<span class="lym-pulse" aria-hidden="true"></span>' +
        PIN_SVG,
      iconSize:   [40, 52],
      iconAnchor: [20, 50],
    });

    const marker = L.marker([lat, lng], {
      icon: icon,
      alt: 'לב ים — פתחו ב-Google Maps',
      title: 'פתחו את לב ים ב-Google Maps',
      riseOnHover: true,
      keyboard: true,
    }).addTo(map);

    if (mapUrl) {
      marker.on('click', function () {
        window.open(mapUrl, '_blank', 'noopener');
      });
      // Keyboard activation (Enter / Space) on the marker element
      const el = marker.getElement();
      if (el) {
        el.setAttribute('role', 'link');
        el.setAttribute('tabindex', '0');
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.open(mapUrl, '_blank', 'noopener');
          }
        });
      }
    }

    // Reveal fade — hide the fallback once tiles arrive
    map.whenReady(function () {
      requestAnimationFrame(function () { frame.classList.add('is-ready'); });
    });
  }

  function init() {
    loadLeaflet().then(buildMap).catch(function () {
      // On load failure leave the fallback visible — graceful degradation
    });
  }

  // Lazy-load: only fetch Leaflet when the map nears the viewport
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          io.disconnect();
          init();
        }
      });
    }, { rootMargin: '300px 0px' });
    io.observe(frame);
  } else {
    init();
  }
})();

/* ── WhatsApp pulse — stop after first page interaction ──────────────── */
(function () {
  const btn = document.querySelector('.wa-float');
  if (!btn) return;

  const STORAGE_KEY = 'lev-yam-wa-interacted';

  if (localStorage.getItem(STORAGE_KEY)) {
    btn.classList.add('pulse-stopped');
    return;
  }

  function stopPulse() {
    btn.classList.add('pulse-stopped');
    localStorage.setItem(STORAGE_KEY, '1');
    document.removeEventListener('click', stopPulse);
    document.removeEventListener('scroll', stopPulse, { passive: true });
  }

  document.addEventListener('click', stopPulse);
  document.addEventListener('scroll', stopPulse, { passive: true });
})();

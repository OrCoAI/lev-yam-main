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

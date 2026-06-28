# Lev Yam — Complete Build Specification for Claude Code

**Project:** Lev Yam (לב ים) — Social entrepreneurship space on the waterfront in Jisr az-Zarqa
**Audience:** B2B (corporate offsites, organizations) + B2C (individuals, families, community)
**Language:** Hebrew (RTL) — primary. Arabic + English may be added later as secondary.
**Deliverable:** Single-page (long-scroll) website, fully responsive, fast, accessible, brand-faithful.
**Date prepared:** April 2026
**Source materials:** Brand book PDF, content doc (`מה זה לב ים.docx`), site map, v2.0 feedback report (Didi/Maya/Or/Elad/Liat/Omer/Moran), and current 2026 industry research.

---

## How to Use This Document

You — Claude Code — are the developer. Read this whole document once before writing any code. It is the single source of truth. When something is ambiguous, default to: (1) brand book, (2) feedback report, (3) general best practices listed here. Do not invent features that aren't requested. Do not pull in heavy frameworks unless this doc tells you to.

The structure is:

1. Project context & guiding principles
2. Tech stack & file structure
3. Design system (colors, type, spacing, motion, RTL rules)
4. Section-by-section page spec (the actual build)
5. Performance budget & accessibility checklist
6. Content (final Hebrew copy, ready to paste)
7. Asset list & placeholders
8. Acceptance criteria — what "done" looks like

---

## 1. Project Context & Guiding Principles

### 1.1 What Lev Yam is, in one paragraph

Lev Yam is an intimate beachfront space in the fishing village of Jisr az-Zarqa, on the Carmel coast. It hosts team off-sites, weekly community days, private events, and full-venue rentals. The brand voice is poetic but the website must be plain-spoken. Every visitor — whether a corporate HR manager booking a retreat or a couple looking for a Friday lunch — must understand within 5 seconds what this place is and how to reach out.

### 1.2 The seven non-negotiables (distilled from the v2.0 feedback report)

These came up across reviewers and are the spine of the rebuild. If a decision conflicts with one of these, the principle wins.

1. **Speed before delight.** Target LCP under 2.5s. Every image WebP/AVIF. No animation that blocks reading.
2. **Plain labels over poetic labels.** "אירועים עסקיים" and "יום ראשון לקהילה" in the navigation, not "מרחב לניווט עסקי" or "מועדון הפעימה הקבועה". Poetry lives in headlines, not labels.
3. **Visible navigation.** A real top nav on desktop. A compact (not full-screen) hamburger on mobile.
4. **WhatsApp everywhere.** Floating sticky button on every page + audience-specific WhatsApp CTAs in each service block, each with a pre-filled Hebrew message.
5. **Brand book discipline.** Two colors max in body (blue `#2c92bf` + cream `#fff7ea`). Orange `#f49834` only as accent (CTAs, dividers, occasional icon). Two heading sizes. Wavy/zigzag dividers from the brand book — no straight horizontal rules.
6. **People in photos.** Hero and service cards must show humans, not empty rooms. Crop heads in or out — no awkward cuts.
7. **Mobile is equal.** Site must look and load as well on a phone in Tel Aviv on 4G as it does on a designer's laptop on fiber.

### 1.3 Audience mapping

The home page must speak to four overlapping audiences without naming them clumsily:

- **Corporate / org buyers** — booking team retreats, off-sites, leadership days. They need: capacity, what's included, photos that look professional, a quick way to send an inquiry.
- **Individuals / freelancers** — looking for a "different" workday by the sea, or for the weekly community day. They need: dates, vibe, who else comes.
- **Families & friends** — booking a private celebration (birthday, gathering, intimate wedding). They need: food, atmosphere, capacity, dietary info.
- **"Dreamers"** — people who want to host their own thing here (workshop, retreat, residency). They need: full venue rental info and a human to talk to.

The four service cards and the four pre-filled WhatsApp messages map to these audiences.

---

## 2. Tech Stack & File Structure

### 2.1 Stack — keep it boring, keep it fast

- **HTML5** — semantic, hand-written. No framework.
- **CSS** — a single hand-written stylesheet (`styles.css`) using modern CSS: custom properties, logical properties (`padding-inline-start` not `padding-left`), `clamp()` for fluid type, `aspect-ratio`, container queries where useful. **No Tailwind, no Bootstrap, no preprocessor.** This site is small enough that a build step adds more complexity than it saves.
- **JavaScript** — a single small `app.js` (vanilla, no framework). Used only for: mobile menu toggle, lightbox gallery, FAQ accordion, sticky-header behavior, lazy-loading fallback if needed, IntersectionObserver-based section reveals (very subtle, see §3.5).
- **No build tools.** No webpack, no Vite, no npm install. Files served as-is. This makes the site trivially deployable to any static host (Netlify, Cloudflare Pages, GitHub Pages, plain S3).
- **Fonts** — self-hosted Google Fonts (`Heebo` + `Assistant`). Self-host because Google Fonts CDN is now blocked from CWV credit and adds a third-party request. See §3.3.
- **Images** — WebP with JPEG fallback via `<picture>`. Hero may include a short muted MP4 (under 6MB, h.264).

### 2.2 File structure

```
/lev-yam/
├── index.html
├── /css/
│   └── styles.css
├── /js/
│   └── app.js
├── /fonts/
│   ├── Heebo-Regular.woff2
│   ├── Heebo-Medium.woff2
│   ├── Heebo-Bold.woff2
│   ├── Assistant-Regular.woff2
│   └── Assistant-SemiBold.woff2
├── /img/
│   ├── /hero/
│   │   ├── hero-poster.webp
│   │   ├── hero-poster.jpg
│   │   └── hero.mp4
│   ├── /services/
│   │   ├── offsite.webp
│   │   ├── community.webp
│   │   ├── private.webp
│   │   └── rental.webp
│   ├── /gallery/
│   │   └── (20–30 images, both .webp and .jpg fallback)
│   ├── /icons/
│   │   ├── palm.svg
│   │   ├── sun.svg
│   │   ├── house.svg
│   │   ├── wave.svg
│   │   ├── arch.svg
│   │   └── heart.svg
│   └── /logo/
│       ├── logo-full.svg
│       ├── logo-mark.svg
│       └── logo-mono.svg
├── /assets/
│   └── og-image.jpg          (1200x630 for WhatsApp/social previews)
├── favicon.svg
├── favicon.ico
├── robots.txt
└── README.md                 (deployment notes)
```

### 2.3 Why this structure

It's discoverable, hostable anywhere, has no hidden dependencies, and a non-developer can update the Hebrew copy by editing one HTML file. That matters because the team will keep editing this site.

---

## 3. Design System

### 3.1 Color tokens

Take these from the brand book and the v2.0 feedback. Define them once in `:root` and use them everywhere via `var()`.

```css
:root {
  /* Primary brand */
  --color-blue:        #2c92bf;   /* Main brand blue from brand book */
  --color-blue-deep:   #1f6f93;   /* Darker shade for hover/contrast */
  --color-cream:       #fff7ea;   /* Brand cream — dominant background */
  --color-orange:      #f49834;   /* Brand orange — ACCENT ONLY (CTAs, dividers) */
  --color-orange-deep: #d97f1f;   /* Hover state for orange CTAs */

  /* Neutrals derived from brand */
  --color-ink:         #1a3340;   /* Body text — deep blue-black, easier than pure black */
  --color-ink-soft:    #4a6571;   /* Secondary text */
  --color-line:        #e8d9b8;   /* Subtle dividers, derived from cream */
  --color-white:       #ffffff;   /* Pure white, used sparingly */
}
```

**Critical rule from feedback:** Body content uses cream + blue + ink. **Orange appears only on CTAs, on the wavy section dividers, and on a few icons** — never as a background, never as a body text color. This was a unanimous note from the reviewers.

### 3.2 Spacing & layout tokens

```css
:root {
  /* Spacing scale — based on 4px grid */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 1rem;      /* 16px */
  --space-4: 1.5rem;    /* 24px */
  --space-5: 2rem;      /* 32px */
  --space-6: 3rem;      /* 48px */
  --space-7: 4rem;      /* 64px */
  --space-8: 6rem;      /* 96px */
  --space-9: 8rem;      /* 128px */

  /* Layout widths */
  --container-max: 1200px;
  --container-narrow: 760px;   /* For prose blocks */

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 14px;
  --radius-lg: 28px;
  --radius-pill: 999px;

  /* Shadows — soft, avoid harsh drop shadows */
  --shadow-sm: 0 2px 8px rgba(26, 51, 64, 0.06);
  --shadow-md: 0 8px 24px rgba(26, 51, 64, 0.10);
}
```

### 3.3 Typography

**Decision:** The brand book lists Futura for Latin. Futura has no native Hebrew companion. For the website (Hebrew-first) use:

- **`Heebo`** (Google Fonts, free, self-hosted) — for body text. Heebo extends Roboto to Hebrew and has excellent screen rendering at small sizes.
- **`Assistant`** (Google Fonts, free, self-hosted) — for display headings. Assistant is geometric and has the modernist, slightly humanist feel that matches the brand book's Futura intent on the Hebrew side.

Load only the weights you actually use (per Core Web Vitals 2026 guidance: fewer weights = faster LCP):

- Heebo: 400 (regular), 500 (medium), 700 (bold)
- Assistant: 400, 600

Self-host as `.woff2`. Use `font-display: swap` and preload the two LCP-critical weights (Heebo 400 + Assistant 600).

```css
@font-face {
  font-family: 'Heebo';
  src: url('/fonts/Heebo-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
/* repeat for each weight */

:root {
  --font-display: 'Assistant', 'Heebo', system-ui, sans-serif;
  --font-body:    'Heebo', 'Assistant', system-ui, sans-serif;
}
```

**Type scale — only TWO heading sizes (per Maya & Moran's feedback):**

```css
:root {
  --text-base:  clamp(1rem, 0.95rem + 0.25vw, 1.125rem);      /* 16–18px body */
  --text-lead:  clamp(1.125rem, 1rem + 0.5vw, 1.375rem);      /* 18–22px lead paragraphs */
  --text-h2:    clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem);       /* 28–40px section heads */
  --text-h1:    clamp(2.5rem, 1.8rem + 3vw, 4.5rem);          /* 40–72px hero only */

  --leading-tight: 1.15;
  --leading-body:  1.65;   /* Hebrew benefits from slightly looser line-height */
}
```

**Hebrew-specific typography rules (research-backed):**

- Right-align body text. Center-align hero headlines.
- Avoid italic Hebrew — it doesn't render well. Use weight changes for emphasis.
- Slightly larger body size (16–18px) than equivalent English sites — Hebrew has no ascenders/descenders so it reads smaller at the same px size.
- Generous `line-height` (1.6–1.7 for body) — Hebrew letters are square and need vertical breathing room.
- Don't bold long stretches — Hebrew bold can feel heavy. Use it for short labels and CTAs only.

### 3.4 RTL implementation rules

This is critical. The site is Hebrew-first.

```html
<html lang="he" dir="rtl">
```

Throughout `styles.css`:

- **Use logical properties exclusively.** `padding-inline-start` instead of `padding-left`. `margin-inline-end` instead of `margin-right`. `border-inline-start-color` instead of `border-left-color`. This means the same CSS works if you ever add an English version — and it forces you to think in "start/end" not "left/right."
- **Flex and grid auto-flip.** With `dir="rtl"`, Flexbox `flex-direction: row` already reverses. You usually don't need `row-reverse`.
- **Icons that imply direction must flip.** Arrows, chevrons, "next/back" indicators — all mirrored. WhatsApp logo, sun, palm tree, house — do NOT flip (they have no inherent direction).
- **Numbers stay LTR inside RTL text.** Phone numbers, prices, dates. Wrap them in `<bdi>` or `<span dir="ltr">` if they render incorrectly: `<bdi>054-1234567</bdi>`.
- **Mixed Hebrew + English** (e.g., a Hebrew sentence with an English brand name) — modern browsers handle this with the Unicode bidi algorithm. Test it. If a brand name like "Starlink" appears in a Hebrew sentence, it should appear inline left-to-right inside the right-to-left flow.
- **Don't right-align everything.** Body paragraphs: right-align. Hero/section headings: usually centered. Buttons: text centered inside the button.

### 3.5 Motion — the hardest-learned lesson from v2.0

The v2.0 feedback was unanimous: **the wave scroll animation was annoying, the per-word text fade-in was annoying, content reloaded on scroll-back.** Don't repeat any of this.

Allowed motion in v3:

- **Section reveal**: A subtle 200–300ms opacity+translateY(8px) fade as a section enters the viewport. Triggered with IntersectionObserver, runs **once**, never re-runs.
- **Hover**: Buttons get a small scale (1.02) + color shift on hover, 150ms.
- **Hero video**: Muted, autoplay, loop, max 6MB, max 15s. With a poster image set so the user sees content immediately and the video fills in.
- **`prefers-reduced-motion`**: Honor it. Wrap all reveals, hover scales, and the hero video autoplay in `@media (prefers-reduced-motion: no-preference)`. If reduced motion is set: no fades, no scales, hero video is replaced by the poster image.

Banned:

- Word-by-word or letter-by-letter text reveals.
- Any scroll-jacking (hijacking the scroll wheel to control animation pace).
- Long full-screen wave/curtain transitions on entry.
- Parallax that moves elements against scroll direction at high speed.
- Anything that re-triggers when you scroll up.

```css
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.4s ease, transform 0.4s ease;
  }
  .reveal.is-visible {
    opacity: 1;
    transform: none;
  }
}
```

### 3.6 The wavy/zigzag divider

The brand book's signature is a wavy/zigzag border on stamps and frames. Use this — but as **a thin SVG divider between sections**, in either blue or orange. This is the only place orange is used as a graphic element in the body.

```html
<svg class="wave-divider" viewBox="0 0 1440 24" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0,12 L40,4 L80,20 L120,4 L160,20 L200,4 L240,20 L280,4 ... Z"
        fill="none" stroke="var(--color-orange)" stroke-width="2"/>
</svg>
```

Use it sparingly: between major sections. Not inside cards. Not inside the FAQ.

---

## 4. Section-by-Section Build Spec

This is the actual page, top to bottom. The site is **a single long-scroll page** (per the original site map). Sections are anchored so the nav can jump to them.

### 4.1 `<head>` and global setup

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#2c92bf">

  <title>לב ים | מרחב חוף בכפר הדייגים ג׳יסר א-זרקא</title>
  <meta name="description" content="לב ים — מרחב חוף אינטימי בכפר הדייגים ג׳יסר א-זרקא. אירועים עסקיים, ימי קהילה, חגיגות פרטיות והשכרת המתחם. הזמינו ביקור בוואטסאפ.">

  <!-- Open Graph for WhatsApp/social link previews — fixes Didi's feedback -->
  <meta property="og:title" content="לב ים | מרחב חוף בכפר הדייגים ג׳יסר א-זרקא">
  <meta property="og:description" content="מרחב פתוח על קו המים. אירועים, ימי קהילה, השכרת מתחם.">
  <meta property="og:image" content="https://levyam.com/assets/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="he_IL">

  <!-- Preload critical assets -->
  <link rel="preload" href="/fonts/Heebo-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/Assistant-SemiBold.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" as="image" href="/img/hero/hero-poster.webp" fetchpriority="high">

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate icon" href="/favicon.ico">

  <link rel="stylesheet" href="/css/styles.css">

  <!-- FAQ schema for SEO (per industry research: 58% of FAQ rich-result clicks) -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "איך מגיעים ללב ים?",
        "acceptedAnswer": { "@type": "Answer", "text": "..." } }
      /* fill from §6 FAQ content */
    ]
  }
  </script>

  <!-- LocalBusiness schema for Google -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "לב ים",
    "image": "https://levyam.com/assets/og-image.jpg",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "ג׳יסר א-זרקא",
      "addressCountry": "IL"
    },
    "url": "https://levyam.com",
    "telephone": "+972-XX-XXXXXXX"
  }
  </script>
</head>
```

### 4.2 Sticky header / navigation

Visible on desktop, compact hamburger on mobile (NOT full-screen — direct response to Or's feedback).

```html
<header class="site-header" id="site-header">
  <div class="header-inner">
    <a href="#top" class="logo" aria-label="לב ים — דף הבית">
      <img src="/img/logo/logo-full.svg" alt="לב ים" width="120" height="40">
    </a>

    <nav class="primary-nav" aria-label="תפריט ראשי">
      <ul>
        <li><a href="#space">המרחב</a></li>
        <li><a href="#services">השירותים שלנו</a></li>
        <li><a href="#why">למה לב ים</a></li>
        <li><a href="#gallery">גלריה</a></li>
        <li><a href="#faq">שאלות ותשובות</a></li>
        <li><a href="#contact">צור קשר</a></li>
      </ul>
    </nav>

    <a class="btn btn-primary header-cta"
       href="https://wa.me/972506669138?text=שלום%2C%20אשמח%20לפרטים%20על%20לב%20ים"
       target="_blank" rel="noopener">
      דברו איתנו <span aria-hidden="true">←</span>
    </a>

    <button class="nav-toggle" aria-label="פתיחת תפריט" aria-expanded="false" aria-controls="mobile-nav">
      <span></span><span></span><span></span>
    </button>
  </div>

  <!-- Mobile drawer — appears below header, NOT full-screen -->
  <nav id="mobile-nav" class="mobile-nav" hidden>
    <ul>
      <li><a href="#space">המרחב</a></li>
      <li><a href="#services">השירותים שלנו</a></li>
      <li><a href="#why">למה לב ים</a></li>
      <li><a href="#gallery">גלריה</a></li>
      <li><a href="#faq">שאלות ותשובות</a></li>
      <li><a href="#contact">צור קשר</a></li>
    </ul>
  </nav>
</header>
```

CSS specifics for the header:

- `position: sticky; top: 0;` with a subtle background blur after scrolling 80px.
- Header height: 64px desktop, 56px mobile.
- Mobile nav opens as a **dropdown panel** below the header — max-height 70vh, scroll if needed. Not a full-screen takeover.
- Logo on the right (RTL natural start). Nav center-right. CTA on the left (RTL natural end).
- The hamburger only shows on `(max-width: 800px)`. The desktop nav hides at the same breakpoint.

### 4.3 Hero section

Per Moran's feedback: close-up of waves and boats (not aerial drone shot). Per Maya/Moran: tagline order = "where the heart meets the sea" (the heart is what arrives, the sea is already there).

```html
<section class="hero" id="top" aria-labelledby="hero-title">
  <div class="hero-media">
    <video class="hero-video"
           autoplay muted loop playsinline
           poster="/img/hero/hero-poster.webp"
           preload="metadata">
      <source src="/img/hero/hero.mp4" type="video/mp4">
    </video>
    <div class="hero-overlay" aria-hidden="true"></div>
  </div>

  <div class="hero-content">
    <p class="hero-eyebrow">מרחב חוף אינטימי בכפר הדייגים ג׳יסר א-זרקא</p>
    <h1 id="hero-title" class="hero-title">איפה שהלב פוגש את הים</h1>
    <p class="hero-lead">
      מרחב פתוח על קו המים — לעבודה, מנוחה, מפגש וחגיגה.
      בקצב שלכם, מול האופק.
    </p>
    <div class="hero-ctas">
      <a class="btn btn-primary"
         href="https://wa.me/972506669138?text=שלום%2C%20אשמח%20לקבל%20פרטים%20על%20לב%20ים"
         target="_blank" rel="noopener">
        דברו איתנו בוואטסאפ
      </a>
      <a class="btn btn-ghost" href="#services">לכל השירותים</a>
    </div>
  </div>
</section>
```

Hero CSS notes:

- `min-height: 88vh` (not 100vh — leaves a sliver showing the next section, signals "there's more below" without needing a scroll-down arrow).
- Video covers the section. A 35–45% dark gradient overlay ensures the white text is legible.
- Title in `--font-display`, weight 600, `--text-h1`.
- Eyebrow text small (16–18px), in `--color-cream`, letter-spaced slightly.
- CTAs centered, stacked on mobile, side-by-side on desktop.
- Video has `poster` so the LCP element is the poster image, not the video — keeps LCP fast.
- If `prefers-reduced-motion: reduce`, hide the video and show only the poster.

### 4.4 Brand intro (immediately after hero)

A short, plain-language paragraph that grounds the visitor. Per Moran's feedback: appears right after the tagline, sets context before the service grid.

```html
<section class="intro" aria-labelledby="intro-title">
  <div class="container container-narrow">
    <h2 id="intro-title" class="section-title">לב ים בקצרה</h2>
    <p class="lead">
      על קו המים של ג׳יסר א-זרקא, בלב חוף הכרמל, נמצא לב ים — מרחב פתוח שבו אפשר
      לעצור לרגע, לנשום, ולתת לרוח הים להזכיר כמה פשוט ויפה יכול להיות הלב כשהוא פתוח.
    </p>
    <p>
      אנחנו בית לימי קהילה, אירועים עסקיים, חגיגות פרטיות והשכרת מתחם מלאה.
      מקום אחד — הרבה דרכים להגיע אליו.
    </p>
  </div>
</section>
```

After this section, place the first wavy divider in orange.

### 4.5 Services grid — the conversion engine

Four cards. Each card = photo + plain title + 1-line description + WhatsApp CTA with **a different pre-filled message per audience** (this implements Moran's 4-button proposal).

```html
<section class="services" id="services" aria-labelledby="services-title">
  <div class="container">
    <header class="section-header">
      <h2 id="services-title" class="section-title">השירותים שלנו</h2>
      <p class="section-sub">בחרו את הדרך שמתאימה לכם — ונדבר.</p>
    </header>

    <div class="services-grid">
      <!-- Card 1: Corporate -->
      <article class="service-card">
        <div class="service-media">
          <picture>
            <source srcset="/img/services/offsite.webp" type="image/webp">
            <img src="/img/services/offsite.jpg" alt="קבוצה יושבת סביב שולחן עץ בלב ים, מול הים"
                 width="800" height="600" loading="lazy">
          </picture>
        </div>
        <div class="service-body">
          <h3>אירועים עסקיים</h3>
          <p>ימי גיבוש, אסטרטגיה ויציאה מהשגרה לצוותים שצריכים מרחב לחשוב יחד.</p>
          <a class="btn btn-primary"
             href="https://wa.me/972506669138?text=שלום%2C%20אנחנו%20מחפשים%20חוויה%20צוותית%20בלב%20ים"
             target="_blank" rel="noopener">
            דברו איתנו על אירוע עסקי
          </a>
        </div>
      </article>

      <!-- Card 2: Community -->
      <article class="service-card">
        <div class="service-media">
          <picture>
            <source srcset="/img/services/community.webp" type="image/webp">
            <img src="/img/services/community.jpg" alt="אנשים יושבים יחד על החוף בשעת בין הערביים"
                 width="800" height="600" loading="lazy">
          </picture>
        </div>
        <div class="service-body">
          <h3>יום ראשון לקהילה</h3>
          <p>מפגש קהילתי שבועי לעבודה, יצירה ושיחה — מול האופק.</p>
          <a class="btn btn-primary"
             href="https://wa.me/972506669138?text=שלום%2C%20אשמח%20להצטרף%20ליום%20הקהילה"
             target="_blank" rel="noopener">
            הצטרפו ליום הקהילה
          </a>
        </div>
      </article>

      <!-- Card 3: Private events -->
      <article class="service-card">
        <div class="service-media">
          <picture>
            <source srcset="/img/services/private.webp" type="image/webp">
            <img src="/img/services/private.jpg" alt="שולחן ערוך לחגיגה משפחתית בלב ים"
                 width="800" height="600" loading="lazy">
          </picture>
        </div>
        <div class="service-body">
          <h3>אירועים פרטיים — נימר מארח</h3>
          <p>חגיגות אינטימיות עם אוכל מהאש של נימר, מול הים.</p>
          <a class="btn btn-primary"
             href="https://wa.me/972506669138?text=שלום%2C%20אשמח%20להגיע%20עם%20המשפחה%20לחגיגה"
             target="_blank" rel="noopener">
            תכננו אירוע פרטי
          </a>
        </div>
      </article>

      <!-- Card 4: Full venue rental -->
      <article class="service-card">
        <div class="service-media">
          <picture>
            <source srcset="/img/services/rental.webp" type="image/webp">
            <img src="/img/services/rental.jpg" alt="המתחם של לב ים בשעת ערב"
                 width="800" height="600" loading="lazy">
          </picture>
        </div>
        <div class="service-body">
          <h3>השכרת המתחם — לב ים שלכם</h3>
          <p>המקום כולו לרשותכם ליום, לסדנה, לריטריט או לחלום שלכם.</p>
          <a class="btn btn-primary"
             href="https://wa.me/972506669138?text=שלום%2C%20אשמח%20למצוא%20בית%20לחלום%20שלי"
             target="_blank" rel="noopener">
            דברו איתנו על השכרה
          </a>
        </div>
      </article>
    </div>
  </div>
</section>
```

Grid: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));` with `gap: var(--space-5)`. On wide screens that gives a 2×2 or 4-across layout naturally; on mobile it stacks.

Each card uses the cream color as background, blue heading, ink body text, orange CTA. Card has `border-radius: var(--radius-md)` and `box-shadow: var(--shadow-sm)`.

### 4.6 The Space — what's included

A two-column on desktop, single-column on mobile. Left = a strong photo. Right = a tight grid of icons + short labels showing what's at the venue. Per the v2.0 task list.

```html
<section class="space" id="space" aria-labelledby="space-title">
  <div class="container space-grid">
    <div class="space-media">
      <picture>
        <source srcset="/img/space-overview.webp" type="image/webp">
        <img src="/img/space-overview.jpg" alt="מבט כללי על מתחם לב ים"
             width="900" height="700" loading="lazy">
      </picture>
    </div>
    <div class="space-info">
      <h2 id="space-title" class="section-title">המרחב</h2>
      <p class="lead">
        מבנה דייגים על קו המים, פרגולה פתוחה לים, מטבח, מקלחות, חיבור Starlink מהיר,
        ומסך 65 אינץ׳ למצגות. כל מה שצריך — בלי מה שלא צריך.
      </p>
      <ul class="amenities">
        <li><img src="/img/icons/house.svg" alt="" width="32" height="32"> סלון פנימי</li>
        <li><img src="/img/icons/palm.svg" alt="" width="32" height="32"> פרגולה מול הים</li>
        <li><img src="/img/icons/wave.svg" alt="" width="32" height="32"> גישה ישירה לחוף</li>
        <li><img src="/img/icons/sun.svg" alt="" width="32" height="32"> מטבח מאובזר</li>
        <li><img src="/img/icons/arch.svg" alt="" width="32" height="32"> מקלחות וחדרי הלבשה</li>
        <li><img src="/img/icons/heart.svg" alt="" width="32" height="32"> Wi-Fi Starlink + מסך 65"</li>
      </ul>
    </div>
  </div>
</section>
```

The amenities list is `display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3);`. Icon + label side-by-side, icon at the start (right side in RTL).

### 4.7 Why Lev Yam — values & "who is this for"

This is the brand-voice section. Pull copy from the source content doc. Two parts:

**Part A — short brand statement** (the poetic part). Centered, narrow column.

**Part B — "מתאים למי?" grid.** 4–6 small cards, each describing one audience type in plain language. Per Moran's feedback.

```html
<section class="why" id="why" aria-labelledby="why-title">
  <div class="container container-narrow">
    <h2 id="why-title" class="section-title">למה לב ים</h2>
    <p class="lead">
      לב ים מתאים לאנשים שהלב שלהם נפתח כשהם רואים אופק. כאלה שמעדיפים שיחה טובה
      על פני רעש, וטבע חי על פני חללים מבריקים מדי. אנשים שאוהבים ים, יצירה, פשטות
      וחיבורים אנושיים כנים.
    </p>
  </div>

  <div class="container">
    <h3 class="subsection-title">מתאים למי?</h3>
    <div class="audience-grid">
      <article class="audience-card">
        <h4>צוותים</h4>
        <p>שמחפשים יום של חשיבה, חיבור ויציאה מהמשרד.</p>
      </article>
      <article class="audience-card">
        <h4>יחידים ופרילנסרים</h4>
        <p>שרוצים יום עבודה אחר, מול הים, עם אנשים נחמדים בסביבה.</p>
      </article>
      <article class="audience-card">
        <h4>משפחות וחברים</h4>
        <p>שמחפשים מקום אינטימי לציון רגע, אירוע או סתם להיות יחד.</p>
      </article>
      <article class="audience-card">
        <h4>ארגונים וקהילות</h4>
        <p>שרוצים להריץ ריטריט, סדנה, או יום עיון בסביבה לא שגרתית.</p>
      </article>
    </div>
  </div>

  <!-- About Jisr az-Zarqa -->
  <div class="container container-narrow village-block">
    <h3 class="subsection-title">על ג׳יסר א-זרקא וכפר הדייגים</h3>
    <p>
      ג׳יסר א-זרקא היא הכפר הערבי-מוסלמי היחיד שנותר על קו החוף הישראלי, בלב רצועת
      חוף הכרמל. כפר הדייגים בו ממוקם לב ים שומר על אופי ייחודי — סירות עץ, רשתות,
      ריח של ים ושל אש. כל ביקור כאן הוא גם מפגש עם מקום, עם אנשים, ועם סיפור.
    </p>
  </div>
</section>
```

### 4.8 Gallery

20–30 curated images, masonry/grid layout, lightbox on click, swipeable on mobile.

```html
<section class="gallery" id="gallery" aria-labelledby="gallery-title">
  <div class="container">
    <header class="section-header">
      <h2 id="gallery-title" class="section-title">גלריה</h2>
      <p class="section-sub">רגעים מלב ים</p>
    </header>

    <div class="gallery-grid">
      <button class="gallery-item" data-full="/img/gallery/01-large.webp">
        <img src="/img/gallery/01-thumb.webp" alt="..." width="600" height="400" loading="lazy">
      </button>
      <!-- repeat for each gallery image -->
    </div>
  </div>

  <!-- Lightbox modal -->
  <dialog class="lightbox" id="lightbox" aria-label="תמונה מוגדלת">
    <button class="lightbox-close" aria-label="סגור">×</button>
    <button class="lightbox-prev" aria-label="הקודם">‹</button>
    <img class="lightbox-img" src="" alt="">
    <button class="lightbox-next" aria-label="הבא">›</button>
  </dialog>
</section>
```

JS: open the native `<dialog>` on item click, set `lightbox-img.src` to the `data-full` value. Arrow keys + swipe to navigate. Close on `Escape` or backdrop click.

Notes:

- Images are in two sizes: thumb (~600px wide, ~40KB WebP) for the grid; large (~1600px wide, ~150KB WebP) for the lightbox.
- All gallery thumbs are `loading="lazy"`. Large versions load on demand.
- Use `image-set()` or `<picture>` if you serve AVIF too.

### 4.9 FAQ

Accordion. 8–12 questions. Most important: include "האם בטוח להגיע לג׳יסר א-זרקא?" — this came up explicitly in the v2.0 task list.

```html
<section class="faq" id="faq" aria-labelledby="faq-title">
  <div class="container container-narrow">
    <h2 id="faq-title" class="section-title">שאלות ותשובות</h2>

    <details class="faq-item">
      <summary>איך מגיעים ללב ים?</summary>
      <div class="faq-answer">
        <p>...</p>
      </div>
    </details>

    <details class="faq-item">
      <summary>כמה אנשים יכולים להגיע?</summary>
      <div class="faq-answer">
        <p>...</p>
      </div>
    </details>

    <!-- repeat -->
  </div>
</section>
```

`<details>` + `<summary>` is native, accessible, no JS needed. Style the `summary` with a `+` / `−` indicator that flips when `[open]`. **Do not** animate the expansion with JS — `<details>` opens instantly and that's fine. (You can add a subtle CSS `transition` on `details[open] .faq-answer` `max-height` if you want, but keep it under 200ms.)

### 4.10 Contact / footer

Map (embedded), Waze + Google Maps + Apple Maps links, the four audience-specific WhatsApp buttons (Moran's idea, repeated here as the final conversion moment), short inquiry form as secondary path, address, social.

```html
<section class="contact" id="contact" aria-labelledby="contact-title">
  <div class="container">
    <header class="section-header">
      <h2 id="contact-title" class="section-title">דברו איתנו</h2>
      <p class="section-sub">יש דברים שצריך לחוות כדי להבין. בואו לבקר.</p>
    </header>

    <div class="contact-grid">
      <div class="contact-map">
        <iframe
          src="https://maps.google.com/maps?q=32.5435,34.9078&output=embed"
          width="100%" height="400" style="border:0;" loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          title="המיקום של לב ים על המפה"></iframe>
        <div class="map-links">
          <a href="https://waze.com/ul/hsvbc45ng5" target="_blank" rel="noopener">פתח ב-Waze</a>
          <a href="https://maps.app.goo.gl/fFtCZYwK1KEcmFud6" target="_blank" rel="noopener">פתח ב-Google Maps</a>
        </div>
      </div>

      <div class="contact-actions">
        <p class="contact-intro">בחרו את הדרך שמתאימה לכם, ונחזור אליכם:</p>
        <a class="btn btn-primary btn-block"
           href="https://wa.me/972506669138?text=שלום%2C%20אנחנו%20מחפשים%20חוויה%20צוותית"
           target="_blank" rel="noopener">אנחנו צוות שמחפש חוויה</a>
        <a class="btn btn-primary btn-block"
           href="https://wa.me/972506669138?text=שלום%2C%20אשמח%20להצטרף%20ליום%20הקהילה"
           target="_blank" rel="noopener">אני רוצה להצטרף לקהילה</a>
        <a class="btn btn-primary btn-block"
           href="https://wa.me/972506669138?text=שלום%2C%20אנחנו%20משפחה%20שמתכננת%20אירוע"
           target="_blank" rel="noopener">אני בא עם המשפחה</a>
        <a class="btn btn-primary btn-block"
           href="https://wa.me/972506669138?text=שלום%2C%20אשמח%20למצוא%20בית%20לחלום%20שלי"
           target="_blank" rel="noopener">יש לי חלום שמחפש בית</a>
      </div>
    </div>
  </div>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <img src="/img/logo/logo-mono.svg" alt="לב ים" width="100" height="40">
        <p>כפר הדייגים, ג׳יסר א-זרקא</p>
      </div>
      <div class="footer-contact">
        <p><a href="tel:+972506669138"><bdi>050-6669138</bdi></a></p>
        <p><a href="mailto:info@levyam.com">info@levyam.com</a></p>
      </div>
      <div class="footer-social">
        <a href="https://instagram.com/levyam_" target="_blank" rel="noopener" aria-label="אינסטגרם">…</a>
        <a href="https://m.facebook.com/profile.php?id=61585790351617" target="_blank" rel="noopener" aria-label="פייסבוק">…</a>
      </div>
      <p class="footer-credit">© לב ים 2026</p>
    </div>
  </footer>
</section>
```

### 4.11 Floating WhatsApp widget — on every page, all the time

```html
<a class="wa-float"
   href="https://wa.me/972506669138?text=שלום%2C%20אשמח%20לפרטים%20על%20לב%20ים"
   target="_blank" rel="noopener"
   aria-label="צור קשר בוואטסאפ">
  <img src="/img/icons/whatsapp.svg" alt="" width="32" height="32">
</a>
```

CSS:
- `position: fixed; bottom: 20px; inset-inline-end: 20px;` (RTL: appears in bottom-left in Hebrew, which is the natural "end" — this is correct).
- 56×56px circle, WhatsApp green `#25D366` background, white icon.
- `box-shadow: 0 4px 16px rgba(0,0,0,0.2);`
- Subtle pulse animation: `@keyframes pulse` 2s ease-out infinite — but pause it after the user has clicked once or interacted with the page (set a flag in `localStorage`).
- z-index: 9999.
- Hide on print: `@media print { .wa-float { display: none; } }`.

---

## 5. Performance Budget & Accessibility Checklist

### 5.1 Performance budget (hard limits)

| Metric | Budget |
|---|---|
| LCP (mobile, Slow 4G) | ≤ 2.5s |
| INP | ≤ 200ms |
| CLS | ≤ 0.1 |
| Total page weight (HTML + CSS + JS + above-fold images) | ≤ 800 KB |
| Total page weight (full page including all gallery thumbs) | ≤ 2.5 MB |
| Hero image (WebP) | ≤ 180 KB |
| Hero video (MP4) | ≤ 6 MB |
| Each gallery thumb | ≤ 50 KB |
| Each service card image | ≤ 80 KB |
| Total CSS file | ≤ 30 KB minified |
| Total JS file | ≤ 12 KB minified |
| Web fonts total | ≤ 90 KB (5 woff2 files) |

### 5.2 Required performance practices

- All images: explicit `width` and `height` attributes (prevents CLS).
- All images below the fold: `loading="lazy"`.
- LCP image (hero poster): `fetchpriority="high"`, NO `loading="lazy"`.
- All images: WebP primary, JPEG fallback via `<picture>`.
- Fonts: `font-display: swap`, preload the two LCP-critical weights only.
- CSS: hand-written, no preprocessor, no unused selectors. Inline critical CSS for hero in `<head>` if file is over 30KB.
- JS: deferred (`<script defer>`), single file, no jQuery, no framework.
- No third-party trackers in initial load. If GA is added, use `<script async>` and load after `DOMContentLoaded`.
- No external CDN font/CSS — all assets local.

### 5.3 Accessibility (WCAG 2.2 AA)

- Color contrast: every text color combination must hit AA (4.5:1 for body, 3:1 for large text). Check the cream + ink combination, blue button + white text, orange button + white text.
- Skip link: `<a class="skip-link" href="#main">דלג לתוכן הראשי</a>` as the first focusable element.
- Focus indicators: visible on every interactive element. Don't remove default focus outlines without replacing them with something equally visible.
- Tap targets: minimum 44×44px on all buttons and links.
- Lang attribute: `<html lang="he" dir="rtl">`.
- Headings: one `<h1>` per page (the hero title). Then `<h2>` for sections, `<h3>` for subsections. Don't skip levels.
- Landmarks: `<header>`, `<nav>`, `<main>`, `<footer>` semantic tags.
- Images: meaningful `alt` text in Hebrew. Decorative images (icons inside labeled buttons): `alt=""`.
- Forms (if added): every input has a visible `<label>`.
- The `<dialog>` lightbox: traps focus when open, returns focus to the trigger on close, closeable with Escape.
- Test with VoiceOver in Hebrew + NVDA in Hebrew before sign-off.

### 5.4 Browser support

- Last 2 versions of: Chrome, Safari, Firefox, Edge.
- iOS Safari 16+.
- Android Chrome 110+.
- No IE11.

---

## 6. Final Hebrew Copy — Ready to Paste

This is the verified Hebrew copy. Use it verbatim. Do not improvise.

### 6.1 Meta

- **Page title:** `לב ים | מרחב חוף בכפר הדייגים ג׳יסר א-זרקא`
- **Meta description:** `לב ים — מרחב חוף אינטימי בכפר הדייגים ג׳יסר א-זרקא. אירועים עסקיים, ימי קהילה, חגיגות פרטיות והשכרת המתחם. הזמינו ביקור בוואטסאפ.`

### 6.2 Hero

- Eyebrow: `מרחב חוף אינטימי בכפר הדייגים ג׳יסר א-זרקא`
- H1 / Tagline: `איפה שהלב פוגש את הים`
- Lead: `מרחב פתוח על קו המים — לעבודה, מנוחה, מפגש וחגיגה. בקצב שלכם, מול האופק.`
- Primary CTA: `דברו איתנו בוואטסאפ`
- Secondary CTA: `לכל השירותים`

### 6.3 Intro paragraph

> על קו המים של ג׳יסר א-זרקא, בלב רצועת חוף הכרמל, נמצא לב ים — מרחב פתוח שבו אפשר לעצור לרגע, לנשום, ולתת לרוח הים להזכיר כמה פשוט ויפה יכול להיות הלב כשהוא פתוח.
>
> אנחנו בית לימי קהילה, אירועים עסקיים, חגיגות פרטיות והשכרת מתחם מלאה. מקום אחד — הרבה דרכים להגיע אליו.

### 6.4 Service cards

| Card | Title | Description | CTA label |
|---|---|---|---|
| 1 | אירועים עסקיים | ימי גיבוש, אסטרטגיה ויציאה מהשגרה לצוותים שצריכים מרחב לחשוב יחד. | דברו איתנו על אירוע עסקי |
| 2 | יום ראשון לקהילה | מפגש קהילתי שבועי לעבודה, יצירה ושיחה — מול האופק. | הצטרפו ליום הקהילה |
| 3 | אירועים פרטיים — נימר מארח | חגיגות אינטימיות עם אוכל מהאש של נימר, מול הים. | תכננו אירוע פרטי |
| 4 | השכרת המתחם — לב ים שלכם | המקום כולו לרשותכם ליום, לסדנה, לריטריט או לחלום שלכם. | דברו איתנו על השכרה |

### 6.5 The Space — amenities list

- סלון פנימי
- פרגולה מול הים
- גישה ישירה לחוף
- מטבח מאובזר
- מקלחות וחדרי הלבשה
- Wi-Fi Starlink + מסך 65"

### 6.6 Why Lev Yam

> לב ים מתאים לאנשים שהלב שלהם נפתח כשהם רואים אופק. כאלה שמעדיפים שיחה טובה על פני רעש, וטבע חי על פני חללים מבריקים מדי. אנשים שאוהבים ים, יצירה, פשטות וחיבורים אנושיים כנים.

**Audience cards:**

- **צוותים** — שמחפשים יום של חשיבה, חיבור ויציאה מהמשרד.
- **יחידים ופרילנסרים** — שרוצים יום עבודה אחר, מול הים, עם אנשים נחמדים בסביבה.
- **משפחות וחברים** — שמחפשים מקום אינטימי לציון רגע, אירוע או סתם להיות יחד.
- **ארגונים וקהילות** — שרוצים להריץ ריטריט, סדנה, או יום עיון בסביבה לא שגרתית.

**About Jisr az-Zarqa:**

> ג׳יסר א-זרקא היא הכפר הערבי-מוסלמי היחיד שנותר על קו החוף הישראלי, בלב רצועת חוף הכרמל. כפר הדייגים בו ממוקם לב ים שומר על אופי ייחודי — סירות עץ, רשתות, ריח של ים ושל אש. כל ביקור כאן הוא גם מפגש עם מקום, עם אנשים, ועם סיפור.

### 6.7 FAQ — 10 questions

1. **איך מגיעים ללב ים?**
   ג׳יסר א-זרקא נגישה ברכב מכביש 2 (יציאת ג׳יסר), כשעה מתל אביב וכ-25 דקות מחיפה. יש חניה חופשית סמוכה למתחם. נשלח לכם הוראות הגעה מדויקות בוואטסאפ.

2. **כמה אנשים יכולים להגיע?**
   המתחם מתאים לקבוצות של עד כ-50 איש לאירועי ישיבה, ועד כ-80 איש לאירועי קוקטייל. נשמח להתאים את הגודל לאופי האירוע שלכם.

3. **מה כלול במתחם?**
   סלון פנימי, פרגולה פתוחה לים, מטבח מאובזר, מקלחות, חיבור Wi-Fi מהיר (Starlink), מסך 65 אינץ׳ למצגות, ועוד. נשלח לכם רשימה מפורטת בהתאם לסוג האירוע.

4. **האם יש אוכל במקום?**
   כן. נימר מארח עם אוכל מהאש המבוסס על חומרי גלם מקומיים — דגים, ירקות, ולחם טרי. אפשר להזמין ארוחה מלאה, פינוקים בין הישיבות, או ארוחת ערב חגיגית.

5. **האם המקום מתאים לילדים?**
   המקום מתאים מאוד למשפחות. החוף נגיש ובטוח, יש מרחב פתוח לילדים לרוץ בו, ובאירועים פרטיים אפשר לתאם פעילות מותאמת.

6. **האם בטוח להגיע לג׳יסר א-זרקא?**
   ג׳יסר א-זרקא היא כפר ערבי-מוסלמי שקט ומסביר פנים. אורחי לב ים מגיעים אלינו דרך כל ימות השנה, יחידים, משפחות וקבוצות. אם יש לכם שאלות נוספות, נשמח לענות בוואטסאפ.

7. **האם יש חניה?**
   כן, יש חניה חופשית סמוכה לכניסה למתחם.

8. **האם אפשר לשכור את המתחם לכל היום?**
   בהחלט. אפשר לשכור את המתחם כולו ליום, לסוף שבוע, או לתקופה ארוכה יותר — לסדנה, לריטריט או לאירוע פרטי.

9. **מה לוח הזמנים של ימי הקהילה?**
   ימי הקהילה מתקיימים בימי ראשון. תאריכים מדויקים מתפרסמים באינסטגרם ובקבוצת הוואטסאפ — נשמח לצרף אתכם.

10. **איך אני מזמין?**
    הדרך הכי פשוטה — שלחו לנו הודעת וואטסאפ עם כמה פרטים על מה שאתם מחפשים, ונחזור אליכם תוך יום עבודה.

### 6.8 Contact section

- Section title: `דברו איתנו`
- Sub: `יש דברים שצריך לחוות כדי להבין. בואו לבקר.`
- Intro before buttons: `בחרו את הדרך שמתאימה לכם, ונחזור אליכם:`

Four audience-specific WhatsApp buttons (text already shown in §4.10):
- `אנחנו צוות שמחפש חוויה`
- `אני רוצה להצטרף לקהילה`
- `אני בא עם המשפחה`
- `יש לי חלום שמחפש בית`

### 6.9 Footer

- Address line: `כפר הדייגים, ג׳יסר א-זרקא`
- Phone: `050-6669138` (replace placeholder)
- Email: `info@levyam.com` (replace if different)
- Copyright: `© לב ים 2026`

---

## 7. Asset List — what's needed before launch

For each asset, note: format, dimensions, whether it exists or needs to be sourced.

### 7.1 Logo (from brand book)
- `logo-full.svg` — full color, palm + house + frame, used in header (120×40 effective)
- `logo-mark.svg` — palm only, blue, used in favicon, social, WhatsApp profile (square)
- `logo-mono.svg` — single color version, used in footer on dark background

### 7.2 Hero
- `hero.mp4` — 1920×1080, h.264, muted, looping, 10–15s, ≤6MB. **Subject:** close-up of waves and boats (per Moran), NOT aerial drone.
- `hero-poster.webp` — 1920×1080, ≤180KB. Same frame as the video starts on.
- `hero-poster.jpg` — fallback, ≤220KB.

### 7.3 Service card photos (4)
Each: 800×600 (4:3), WebP ≤80KB + JPG fallback ≤120KB. All must include people.
- `offsite.webp` — team gathered, possibly around a table, daylight
- `community.webp` — a small group, casual, sunset hour
- `private.webp` — celebration moment, food/table visible
- `rental.webp` — wide shot of the venue at golden hour

### 7.4 Space overview
- `space-overview.webp` — 900×700, ≤90KB. Wide angle of the venue showing pergola + sea.

### 7.5 Gallery (20–30 images)
Per image:
- Thumb: 600×400, WebP ≤50KB
- Large: 1600×1200, WebP ≤180KB

**Storytelling arc** (curate in this order):
1–4: location & approach (the village, the path to the venue)
5–10: the space itself (interior, pergola, details)
11–18: people in action (working, eating, talking, laughing)
19–24: food & drink
25–30: golden hour & sea moments

### 7.6 Icons
SVG, single-color, 32×32 viewport, in either blue or orange depending on context:
- palm.svg, sun.svg, house.svg, wave.svg, arch.svg, heart.svg
- whatsapp.svg (official WhatsApp green)
- chevron.svg (for FAQ accordions)

### 7.7 Open Graph
- `og-image.jpg` — 1200×630, ≤200KB. Lev Yam tagline + logo + a strong hero photo. This is what shows when the site is shared on WhatsApp/Facebook.

### 7.8 Phone number & WhatsApp number
The placeholder `+972506669138` and `050-6669138` must be replaced everywhere with the real number before launch. Also update the WhatsApp number inside every `wa.me/` URL — there are at least 12 of them. Use a global find-and-replace.

---

## 8. Acceptance Criteria — definition of done

The site is "done" when ALL of the following are true. Tick each off before delivery.

### Content
- [ ] All Hebrew copy from §6 is in place, verbatim.
- [ ] No placeholder text (`Lorem ipsum`, `XXXX`, `TBD`) anywhere in the rendered page.
- [ ] All `wa.me` links point to the real WhatsApp number.
- [ ] Phone number and email in footer are real.
- [ ] Map embed shows the actual Lev Yam location.
- [ ] All 4 service-card images show people, not empty rooms.

### Performance (run PageSpeed Insights on mobile)
- [ ] LCP ≤ 2.5s
- [ ] INP ≤ 200ms
- [ ] CLS ≤ 0.1
- [ ] Performance score ≥ 90 on mobile, ≥ 95 on desktop
- [ ] Total page weight ≤ 2.5 MB
- [ ] All images have explicit width and height
- [ ] All below-fold images have `loading="lazy"`
- [ ] Hero image has `fetchpriority="high"`

### Branding
- [ ] Only the 3 brand colors appear in the design (blue, cream, orange) plus the two derived neutrals (ink, ink-soft).
- [ ] Orange appears only on CTAs, dividers, and select icons — never as a body background.
- [ ] No more than 2 heading sizes are used.
- [ ] Wavy/zigzag dividers from the brand book appear between major sections — no straight horizontal rules.
- [ ] Logo from brand book is used (no other logos or icons that conflict).

### RTL & Hebrew
- [ ] `<html dir="rtl" lang="he">` is set.
- [ ] No `padding-left`/`margin-right` etc. — all CSS uses logical properties.
- [ ] Hebrew text right-aligned in body, centered in hero.
- [ ] Phone numbers display correctly LTR inside RTL paragraphs.
- [ ] Mixed Hebrew/English (e.g. "Wi-Fi Starlink") renders cleanly with no broken word order.

### Navigation & CTAs
- [ ] Top nav is visible on desktop ≥ 800px wide.
- [ ] Mobile hamburger opens a compact drawer below the header — NOT a full-screen takeover.
- [ ] Sticky WhatsApp float button is on every section, bottom-end (visually bottom-left in Hebrew).
- [ ] Each service card has its own pre-filled WhatsApp message.
- [ ] The 4 audience-specific WhatsApp buttons in the contact section work.

### Mobile
- [ ] CTA buttons have proper margin from screen edges (no edge-touching).
- [ ] Tap targets ≥ 44×44px.
- [ ] Colors render identically on iOS Safari and Android Chrome (per Or's feedback — this was a v2.0 bug).
- [ ] Logo area has correct spacing on mobile.
- [ ] Hero video either plays or falls back to poster cleanly. No layout shift on load.

### Animation behavior
- [ ] No word-by-word text fade-in.
- [ ] No long wave-curtain transitions.
- [ ] Section reveals are subtle (≤ 400ms, ≤ 8px translate) and trigger ONCE per page load.
- [ ] Scrolling back up does not re-trigger any animation.
- [ ] `prefers-reduced-motion` is honored — all animations and the hero video are disabled when the user has it on.

### Accessibility
- [ ] Lighthouse Accessibility score ≥ 95.
- [ ] All interactive elements have visible focus states.
- [ ] All images have meaningful Hebrew `alt` text (or `alt=""` if decorative).
- [ ] Skip-to-content link is the first focusable element.
- [ ] Color contrast passes AA everywhere.
- [ ] FAQ uses native `<details>`/`<summary>` (or has full ARIA if custom).
- [ ] Keyboard-only user can reach and operate every CTA, the gallery lightbox, and the FAQ.

### SEO
- [ ] Meta title and description are set.
- [ ] Open Graph tags are set with a 1200×630 image.
- [ ] FAQPage JSON-LD schema is included with the FAQ content.
- [ ] LocalBusiness JSON-LD schema is included with address + phone + URL.
- [ ] `robots.txt` allows crawling.
- [ ] Sharing the URL on WhatsApp shows a branded preview (logo + title + photo) — direct fix for Didi's feedback.

### Code quality
- [ ] Single `index.html`, single `styles.css`, single `app.js`. No build step.
- [ ] No console errors or warnings on page load.
- [ ] No mixed content warnings.
- [ ] HTML validates (W3C validator clean).
- [ ] No external CDN requests on initial load (fonts are self-hosted, no Google Fonts CDN call).

### Cross-browser
- [ ] Tested and clean on: latest Chrome (desktop + Android), latest Safari (desktop + iOS), latest Firefox, latest Edge.

---

## 9. Final Notes for Claude Code

- **Build order:** scaffolding → CSS tokens → header → hero → services grid → space → why → gallery → FAQ → contact/footer → wave dividers → JS interactions → performance pass → accessibility pass.
- **When in doubt, fewer features.** This site succeeds on speed and clarity, not novelty. Every animation, every plugin, every clever trick is a possible regression of a v2.0 reviewer note.
- **Test on a real phone, not just the device emulator.** The v2.0 mobile bugs (color drift, edge-touching CTAs, full-screen menu) all passed desktop QA and got caught only on actual phones.
- **The Hebrew copy in §6 is final.** If the client wants edits, change them only there and propagate. Don't paraphrase Hebrew on the fly.
- **The WhatsApp number is the most important field on the entire site.** When the real number arrives, do a full grep across the codebase and replace every instance, then verify each link manually by clicking it on a phone.

End of build spec.

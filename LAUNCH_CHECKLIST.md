# Lev Yam — Launch Checklist

**Website:** levyam.com
**Run this checklist before going live. Every box must be ticked.**

---

## CONTENT

- [ ] No placeholder text anywhere (no `img-placeholder` divs visible — all replaced with real photos)
- [ ] Hero tagline: `המקום שבו הלב פוגש את הים` ✓
- [ ] All 5 service cards have titles, descriptions, and WhatsApp CTAs
- [ ] All 10 FAQ questions and answers are present
- [ ] Village / Jisr az-Zarqa paragraph is in the Why section
- [ ] Footer shows correct address: `כפר הדייגים, ג׳יסר א-זרקא`
- [ ] Copyright year is `© לב ים 2026`
- [ ] Logo appears in header and footer (not the text placeholder)

---

## CONTACT DETAILS — CHECK EVERY INSTANCE

- [ ] All WhatsApp links use `wa.me/972506669138`
- [ ] Footer phone shows `050-6669138`
- [ ] Footer email shows `info@levyam.com`
- [ ] Tel link: `href="tel:+972506669138"`
- [ ] Email link: `href="mailto:info@levyam.com"`
- [ ] Instagram links to `https://instagram.com/levyam_`
- [ ] Facebook links to `https://m.facebook.com/profile.php?id=61585790351617`

---

## WHATSAPP — PRE-FILLED MESSAGES

Click each link and verify the correct pre-filled Hebrew message opens in WhatsApp:

- [ ] Header CTA → `שלום, אשמח לפרטים על לב ים`
- [ ] Hero CTA → `שלום, אשמח לקבל פרטים על לב ים`
- [ ] Business card → `שלום, אנחנו צוות שמחפשים חוויה צוותית בלב ים`
- [ ] Community card → `שלום, אשמח להצטרף ליום הקהילה`
- [ ] Private events card → `שלום, אשמח להגיע עם המשפחה לחגיגה`
- [ ] Venue rental card → `שלום, אשמח למצוא בית לחלום שלי`
- [ ] Weekend card → `שלום, אשמח לפרטים על סופי שבוע בלב ים`
- [ ] Contact — team button → `שלום, אנחנו צוות שמחפשים חוויה`
- [ ] Contact — community button → `שלום, אשמח להצטרף למשפחה`
- [ ] Contact — private button → `שלום, אנחנו משפחה שמתכננת אירוע`
- [ ] Contact — dream button → `שלום, יש לי חלום שמחפש בית`
- [ ] Floating sticky button → `שלום, אשמח לפרטים על לב ים`

---

## MAP & NAVIGATION

- [ ] Google Maps embed shows correct location (Jisr az-Zarqa fishing village)
- [ ] Waze link `https://waze.com/ul/hsvbc45ng5` opens and navigates correctly
- [ ] Google Maps link `https://maps.app.goo.gl/fFtCZYwK1KEcmFud6` opens correctly

---

## PHOTOS

- [ ] Hero has a real photo/video (not placeholder)
- [ ] All 5 service card photos show **people** (not empty rooms)
- [ ] Space overview photo is real
- [ ] Gallery has at least 12 images
- [ ] `og-image.jpg` exists in `/assets/` (1200×630)

---

## PERFORMANCE (run Google PageSpeed Insights — mobile)

URL to test: `https://levyam.com`

- [ ] LCP (Largest Contentful Paint) ≤ 2.5 seconds
- [ ] INP ≤ 200ms
- [ ] CLS ≤ 0.1
- [ ] Performance score ≥ 90 on mobile
- [ ] Performance score ≥ 95 on desktop
- [ ] Total page weight ≤ 2.5 MB
- [ ] All images have `width` and `height` attributes
- [ ] All below-fold images have `loading="lazy"`
- [ ] Hero image has `fetchpriority="high"` and NO `loading="lazy"`

---

## BRANDING

- [ ] Logo from Elad appears correctly in header and footer (not text placeholder)
- [ ] Only 3 brand colors: blue `#2c92bf`, cream `#fff7ea`, orange `#f49834`
- [ ] Wavy dividers appear between major sections

---

## RTL & HEBREW

- [ ] `<html lang="he" dir="rtl">` is set
- [ ] Body text is right-aligned
- [ ] Hero headline is centered
- [ ] Phone number renders correctly left-to-right inside Hebrew text
- [ ] No CSS uses `padding-left`, `margin-right` — only logical properties

---

## NAVIGATION

- [ ] Top nav visible on desktop (≥800px)
- [ ] Desktop nav shows all 6 links: המרחב / השירותים שלנו / למה לב ים / גלריה / שאלות ותשובות / צור קשר
- [ ] Mobile hamburger opens a compact drawer
- [ ] Clicking a nav link scrolls to the correct section
- [ ] Sticky WhatsApp float button visible at all times
- [ ] Header stays sticky on scroll

---

## MOBILE (test on a real device)

**Test on: real iPhone (Safari) + real Android (Chrome)**

- [ ] Site looks correct on iPhone Safari
- [ ] Site looks correct on Android Chrome
- [ ] CTA buttons have proper spacing — not touching screen edges
- [ ] Tap targets are at least 44×44px
- [ ] Hero video either plays or falls back to poster image cleanly
- [ ] Gallery is swipeable on mobile
- [ ] FAQ opens and closes correctly
- [ ] Hamburger menu opens and closes correctly
- [ ] Floating WhatsApp button doesn't block content

---

## ANIMATIONS & MOTION

- [ ] Section reveals are subtle (≤400ms, ≤8px translate)
- [ ] Sections reveal once — scrolling back up does NOT re-trigger
- [ ] `prefers-reduced-motion` respected — animations off if user has it enabled
- [ ] Hero video hidden (poster only) when `prefers-reduced-motion` is on

---

## ACCESSIBILITY (run Lighthouse in Chrome DevTools)

- [ ] Lighthouse Accessibility score ≥ 95
- [ ] Skip-to-content link is the first focusable element
- [ ] All images have meaningful Hebrew `alt` text (or `alt=""` for decorative)
- [ ] All interactive elements have visible focus states
- [ ] FAQ is keyboard-navigable
- [ ] Gallery lightbox: opens with Enter, closes with Escape, arrow keys navigate
- [ ] One `<h1>` on the page (the hero tagline)

---

## SEO & SHARING

- [ ] `<title>` = `לב ים | מרחב חוף בכפר הדייגים ג׳יסר א-זרקא`
- [ ] Meta description is set
- [ ] Open Graph tags are set (`og:title`, `og:description`, `og:image`, `og:locale`)
- [ ] **Share the URL in WhatsApp** — confirm it shows: logo + title + image
- [ ] FAQPage JSON-LD schema is in `<head>`
- [ ] LocalBusiness JSON-LD schema is in `<head>`
- [ ] `robots.txt` is at the root and allows crawling

---

## CODE QUALITY

- [ ] No console errors or warnings in Chrome DevTools
- [ ] No mixed-content warnings (everything on HTTPS)
- [ ] No external CDN calls on load (fonts are self-hosted)

---

## CROSS-BROWSER

- [ ] Chrome desktop ✓
- [ ] Chrome Android ✓
- [ ] Safari desktop ✓
- [ ] Safari iOS ✓
- [ ] Firefox desktop ✓
- [ ] Edge desktop ✓

---

## FINAL SIGN-OFF

- [ ] All boxes above are ticked
- [ ] Real phone, email, and WhatsApp number tested by calling/messaging them
- [ ] Site shared on WhatsApp to confirm branded preview appears
- [ ] DNS pointing `levyam.com` to the hosting provider
- [ ] HTTPS certificate active (green padlock in browser)

**Ready to launch! 🎉**

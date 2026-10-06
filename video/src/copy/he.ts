import type { WeekendReelProps } from "../levyam/schema";

// Source: levyam.com/happening/weekend/ (read 2026-10-05) and the site repo's FACTS.md.
// Hours are the owner's (2026-10-05): the live page still shows 10:00–17:00 in its header
// and 10:00–16:00 in its text.
export const he: WeekendReelProps = {
  lang: "he",
  hook: "title",
  title: "בית פתוח בלב\u00A0ים",
  days: "כל שישי ושבת",
  hours: [
    { day: "שישי", time: "10:00–15:00" },
    { day: "שבת", time: "10:00 עד השקיעה" },
  ],
  highlightsHeading: "מה מחכה לכם",
  highlights: ["ארוחות בוקר", "אוכל מקומי של המשפחה", "דגים טריים מהים"],
  audience: "כולם מוזמנים",
  cost: "חינם · ללא הרשמה מראש",
  location: { place: "בכפר הדייגים", area: "ג'סר א-זרקא · חוף הכרמל" },
  cta: {
    headline: "נתראה בסופ״ש",
    line: "כל הפרטים באתר",
    url: "levyam.com/happening/weekend",
  },
};

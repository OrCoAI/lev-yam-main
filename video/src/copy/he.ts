import type { WeekendReelProps } from "../levyam/schema";
import type { MomentsProps } from "../levyam/moments/schema";
import { placeholderQuotes } from "../levyam/team-day/quotes";
import type { TeamDayProps } from "../levyam/team-day/schema";

// Source: levyam.com/happening/weekend/ (read 2026-10-05) and the site repo's FACTS.md.
// Hours: FACTS.md "שעות סופי השבוע" (seasonal, dated 2026-10-06). The live page showed
// 10:00–17:00 / 10:00–16:00 on 2026-10-05 — the owner updates the /app/events item.
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

// moments-by-the-sea — video/briefs/moments-by-the-sea.md (Gate 1 2026-10-06). FACTS.md § זהות
// (name), § מיקום והגעה (village), § המתחם (internet, pergola facing the sea), § מטבח (sea-to-table).
// The hook is set per composition in Root.tsx, not here.
export const moments: Omit<MomentsProps, "hook"> = {
  lang: "he",
  name: "לב\u00A0ים",
  village: "כפר הדייגים",
  area: "ג'סר א-זרקא",
  work: "לעבוד מול הים",
  food: "אוכל מקומי, מהים לשולחן",
  sunset: "ובערב, שקיעה מול הים",
};

// team-day-guests — video/briefs/team-day-guests.md (Gate 1 2026-10-07). FACTS.md § שירותים (team
// days), § זהות (on the waterline; WhatsApp 972506669138, shown in local form), § מיקום והגעה. The
// quotes are placeholders here: the real ones come from the gitignored private file (quotes.ts).
export const teamDay: Omit<TeamDayProps, "hook"> = {
  lang: "he",
  footage: "יום צוות על קו המים",
  question: "מחפשים מקום ליום צוות?",
  heading: "מה אומרים האורחים",
  village: "כפר הדייגים",
  area: "ג'סר א-זרקא",
  cta: { headline: "רוצים יום כזה לצוות?", line: "כתבו לנו בוואטסאפ", phone: "050-666-9138" },
  quotes: placeholderQuotes("he"),
};

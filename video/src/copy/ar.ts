import type { WeekendReelProps } from "../levyam/schema";
import type { MomentsProps } from "../levyam/moments/schema";
import { placeholderQuotes } from "../levyam/team-day/quotes";
import type { TeamDayProps } from "../levyam/team-day/schema";

// Source: levyam.com/happening/ar/weekend/ (read 2026-10-05); hours: FACTS.md "שעות סופי השבוע"
// (seasonal, dated 2026-10-06). Lines marked [ar-draft] are not verbatim from the site and need a
// native Levantine reader before the final render.
// The live page's cost field says "حر" (free as in liberty) — "ببلاش" here is the fix.
export const ar: WeekendReelProps = {
  lang: "ar",
  hook: "title",
  title: "يوم مفتوح في ليف\u00A0يام",
  days: "كل جمعة وسبت", // [ar-draft] site: "كل الجمعة والسبت"
  hours: [
    { day: "الجمعة", time: "10:00–15:00" },
    { day: "السبت", time: "10:00 حتى غروب\u00A0الشمس" },
  ],
  highlightsHeading: "شو بيستنّاكم", // [ar-draft]
  highlights: ["فطور", "أكل بلدي من مطبخ العيلة", "سمك طازة من البحر"], // [ar-draft]
  audience: "الكل معزوم", // [ar-draft]
  cost: "ببلاش · بدون تسجيل مسبق", // [ar-draft] "ببلاش"
  location: { place: "بقرية الصيادين", area: "جسر الزرقاء · شاطئ الكرمل" },
  cta: {
    headline: "بنستنّاكم بالويكند", // [ar-draft]
    line: "كل التفاصيل عالموقع", // [ar-draft]
    url: "levyam.com/happening/ar/weekend",
  },
};

// moments-by-the-sea — video/briefs/moments-by-the-sea.md. Every line [ar-draft] until a native
// Levantine reader signs it off; name and place as in FACTS.md and the weekend copy above.
// The hook is set per composition in Root.tsx, not here.
export const moments: Omit<MomentsProps, "hook"> = {
  lang: "ar",
  name: "ليف\u00A0يام",
  village: "قرية الصيادين",
  area: "جسر الزرقاء",
  work: "نشتغل قبال البحر", // [ar-draft]
  food: "أكل محلي، من\u00A0البحر للسفرة", // [ar-draft] "من البحر" kept on one line
  sunset: "وبالمسا، غروب قبال البحر", // [ar-draft]
};

// team-day-guests — video/briefs/team-day-guests.md. Every line [ar-draft] until a native Levantine
// reader signs it off; village and area as in moments above. The quotes (translated from the Hebrew
// reviews, hence `translated`) come from the gitignored private file (quotes.ts).
export const teamDay: Omit<TeamDayProps, "hook"> = {
  lang: "ar",
  footage: "يوم للفريق على شط البحر", // [ar-draft]
  question: "بتدوروا على مكان ليوم الفريق؟", // [ar-draft]
  heading: "شو بيحكوا ضيوفنا", // [ar-draft]
  translated: "مترجم من العبرية", // [ar-draft]
  village: "قرية الصيادين",
  area: "جسر الزرقاء",
  cta: { headline: "بدكم يوم متل هاد لفريقكم؟", line: "اكتبوا لنا على واتساب", phone: "050-666-9138" }, // [ar-draft]
  quotes: placeholderQuotes("ar"),
};

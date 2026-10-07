import type { CalculateMetadataFunction } from "remotion";
import { loadPrivate } from "../../data";
import { QUOTE_SLOTS, type Quote, type TeamDayProps } from "./schema";

// The five quotes are public Google reviews, but their texts are NOT in this public repo (owner,
// 2026-10-06; guidelines §1.1) — like data.ts's reviews, they live in the gitignored
//   video/public/private/team-day/quotes.json
//   { "quotes": [{ "label": { "he": "אורחת", "ar": "ضيفة" }, "he": "…", "ar": "…" }, …] }  (exactly 5)
// read through data.ts's `loadPrivate` (Studio shows the placeholders, a render needs the file).
// The event footage sits in the same folder.
const QUOTES_FILE = "private/team-day/quotes.json";

export const placeholderQuotes = (lang: TeamDayProps["lang"]): Quote[] =>
  Array.from({ length: QUOTE_SLOTS }, (_, i) => ({
    label: lang === "he" ? "אורח/ת" : "ضيف/ة",
    text: lang === "he" ? `[חסר: ציטוט ${i + 1}]` : `[مفقود: اقتباس ${i + 1}]`,
  }));

type Entry = { label: Record<string, string>; he: string; ar: string };

const isEntry = (q: unknown): q is Entry =>
  typeof q === "object" &&
  q !== null &&
  typeof (q as Entry).he === "string" &&
  typeof (q as Entry).ar === "string" &&
  typeof (q as Entry).label?.he === "string" &&
  typeof (q as Entry).label?.ar === "string";

export const loadQuotes: CalculateMetadataFunction<TeamDayProps> = ({ props }) =>
  loadPrivate(
    QUOTES_FILE,
    props,
    (json) => {
      const { quotes } = json as { quotes?: unknown };
      return Array.isArray(quotes) && quotes.length === QUOTE_SLOTS && quotes.every(isEntry)
        ? { ...props, quotes: quotes.map((q) => ({ label: q.label[props.lang], text: q[props.lang] })) }
        : null;
    },
    `exactly ${QUOTE_SLOTS} {label: {he, ar}, he, ar} quotes`,
  );

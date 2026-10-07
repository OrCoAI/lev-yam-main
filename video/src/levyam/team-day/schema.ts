import { z } from "zod";

// team-day-guests (video/briefs/team-day-guests.md): a real team day at the venue, five guests'
// Google reviews over its footage, the WhatsApp ask. Every word on screen comes from
// src/copy/<lang>.ts — except the quotes, which come from the gitignored private file (quotes.ts).
export const QUOTE_SLOTS = 5;
const quote = z.object({ label: z.string(), text: z.string() });

export const teamDaySchema = z.object({
  lang: z.enum(["he", "ar"]),
  // The opening 3s (shot 1): footage first with no text, or a question.
  hook: z.enum(["footage", "question"]),
  footage: z.string(),
  question: z.string(),
  heading: z.string(),
  // Arabic only: the quotes are translated from the Hebrew reviews, and the beat says so.
  translated: z.string().optional(),
  village: z.string(),
  area: z.string(),
  cta: z.object({ headline: z.string(), line: z.string(), phone: z.string() }),
  quotes: z.array(quote).length(QUOTE_SLOTS),
});

export type TeamDayProps = z.infer<typeof teamDaySchema>;
export type Quote = z.infer<typeof quote>;

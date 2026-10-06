import { z } from "zod";

// One event = one props object. Every word on screen comes from here, so the next
// event's reel is a new src/copy/<lang>.ts entry, not new markup. Words reveal one at a time
// and wrap at spaces; join a phrase that must not break (a name) with "\u00A0".
export const weekendReelSchema = z.object({
  lang: z.enum(["he", "ar"]),
  // Which opening 3s plays (see beats/HookBeat.tsx); ship at least two per creative.
  hook: z.enum(["title", "free"]),
  title: z.string(),
  days: z.string(),
  hours: z.array(z.object({ day: z.string(), time: z.string() })).min(1).max(2),
  highlightsHeading: z.string(),
  highlights: z.array(z.string()).min(1).max(3),
  audience: z.string(),
  cost: z.string(),
  location: z.object({ place: z.string(), area: z.string() }),
  cta: z.object({ headline: z.string(), line: z.string(), url: z.string() }),
});

export type WeekendReelProps = z.infer<typeof weekendReelSchema>;

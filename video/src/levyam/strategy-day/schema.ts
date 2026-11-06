import { z } from "zod";

// strategy-day-by-the-sea (video/briefs/strategy-day-by-the-sea.md): the window, three postcards
// (small-group work, then two from a real strategy day), then the ask. Every word on screen comes from src/copy/<lang>.ts.
export const strategyDaySchema = z.object({
  lang: z.enum(["he", "ar"]),
  // The opening 3s (shot 1): the question, or footage first with no text for 0.5s.
  hook: z.enum(["question", "footage"]),
  question: z.string(),
  footage: z.string(),
  groups: z.string(),
  table: z.string(),
  circle: z.string(),
  cta: z.object({ headline: z.string(), line: z.string(), phone: z.string() }),
});

export type StrategyDayProps = z.infer<typeof strategyDaySchema>;

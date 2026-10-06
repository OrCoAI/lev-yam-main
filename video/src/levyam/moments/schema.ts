import { z } from "zod";

// moments-by-the-sea (video/briefs/moments-by-the-sea.md): three moments of a day at the venue,
// then a sign-off. Every word on screen comes from src/copy/<lang>.ts.
export const momentsSchema = z.object({
  lang: z.enum(["he", "ar"]),
  // The opening 2.2s (shot 1): footage first with no text, the name, or the place.
  hook: z.enum(["footage", "name", "place"]),
  name: z.string(),
  village: z.string(),
  area: z.string(),
  work: z.string(),
  food: z.string(),
  sunset: z.string(),
});

export type MomentsProps = z.infer<typeof momentsSchema>;

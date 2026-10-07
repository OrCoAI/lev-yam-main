import { loadFont as loadAssistant } from "@remotion/google-fonts/Assistant";
import { loadFont as loadHeebo } from "@remotion/google-fonts/Heebo";
import { loadFont as loadNotoSansArabic } from "@remotion/google-fonts/NotoSansArabic";
import type React from "react";
import type { WeekendReelProps } from "./schema";

// levyam.com css/styles.css: --font-display is Assistant, --font-body is Heebo (Hebrew + Latin
// subsets). html[lang=ar] swaps both to 'SF Arabic', 'Geeza Pro', 'Noto Sans Arabic' — the first
// two are Apple system fonts a render cannot load, so Arabic uses Noto Sans Arabic for both roles.
const { fontFamily: assistant } = loadAssistant("normal", {
  weights: ["600", "800"],
  subsets: ["hebrew", "latin"],
});
const { fontFamily: heebo } = loadHeebo("normal", {
  weights: ["500", "600"],
  subsets: ["hebrew", "latin"],
});
const { fontFamily: notoSansArabic } = loadNotoSansArabic("normal", {
  weights: ["500", "600", "800"],
  subsets: ["arabic", "latin"],
});

export const TYPE = {
  he: { display: assistant, body: heebo, hero: 170, headline: 100, text: 50, small: 40, headLeading: 1.12, textLeading: 1.3 },
  ar: { display: notoSansArabic, body: notoSansArabic, hero: 160, headline: 88, text: 46, small: 40, headLeading: 1.4, textLeading: 1.55 },
} as const;

export type Type = (typeof TYPE)[keyof typeof TYPE];

// css/styles.css :root tokens; the theme-color meta is #2c92bf.
export const C = {
  blue: "#2c92bf",
  blueDeep: "#1f6f93",
  cream: "#fff7ea",
  orange: "#f49834",
  ink: "#1a3340",
  inkSoft: "#4a6571",
} as const;

// Brief: top ≥150, bottom ≥170, sides ≥60. Instagram's like / comment / share column sits on
// the right of the lower half — exactly where RTL text starts — so text keeps a wider start inset.
export const SAFE = { top: 150, bottom: 170, side: 60 } as const;
export const TEXT = { start: 150, end: 72, top: SAFE.top + 50, bottom: SAFE.bottom + 90 } as const;

// Meta's own Reels / Stories safe zone (Meta Ads Guide, read 2026-10-06), as fractions of the
// frame so one definition serves 9:16 and 4:5: 14% top, 35% bottom, 6% sides, and the
// like/comment/share rail (~21% wide) over the lower 40%. ZONE is the text zone guidelines §3
// names — x 120–853, y 288–1248 on 1080×1920 (853 = where the rail starts; the zone never
// overlaps a band). <SafeZone /> draws both in Studio and the reviewer
// checks against them; a §3 change in the guidelines is mirrored here. SAFE/TEXT above are the
// 2026-10-05 numbers the two shipped reels still use — re-layout is the follow-up in
// docs/plans/video-pipeline.md.
export const META = { top: 0.14, bottom: 0.35, side: 0.06, rail: { width: 0.21, height: 0.4 } } as const;
export const ZONE = { x0: 120 / 1080, x1: 1 - 0.21, y0: 288 / 1920, y1: 1248 / 1920 } as const;
// Inner margin text keeps from ZONE's edges, so descenders and side bearings stay inside, not on it.
export const ZONE_INSET = 12;

// Frames per word entry; a block's entry is ENTER plus its stagger.
export const ENTER = 16;

// Ken Burns end scale ceiling (guidelines §5).
export const KEN_BURNS_MAX = 1.1;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const SHADOW = "0 2px 18px rgba(10, 25, 33, 0.45)";

export const headline = (t: Type, color: string, shadow = true): React.CSSProperties => ({
  fontFamily: t.display,
  fontSize: t.headline,
  fontWeight: 800,
  lineHeight: t.headLeading,
  color,
  textShadow: shadow ? SHADOW : undefined,
});

// The display role one size up (TYPE.*.hero) — a name that is the whole frame.
export const hero = (t: Type, color: string, shadow = true): React.CSSProperties => ({
  ...headline(t, color, shadow),
  fontSize: t.hero,
});

export const body = (t: Type, color: string, shadow = true): React.CSSProperties => ({
  fontFamily: t.body,
  fontSize: t.text,
  fontWeight: 600,
  lineHeight: t.textLeading,
  color,
  textShadow: shadow ? SHADOW : undefined,
});

// The small role — an attribution or a source line under body text; never under 36 px (§4).
export const caption = (t: Type, color: string, shadow = true): React.CSSProperties => ({
  ...body(t, color, shadow),
  fontSize: t.small,
});

export type BeatProps = { readonly copy: WeekendReelProps; readonly duration: number };

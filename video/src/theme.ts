import { loadFont as loadAssistant } from "@remotion/google-fonts/Assistant";
import { loadFont as loadHeebo } from "@remotion/google-fonts/Heebo";

// Brand book specifies Futura (commercial, not available). levyam.com substitutes
// Heebo for display and Assistant for body — the video follows the site.
export const { fontFamily } = loadHeebo("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["hebrew", "latin"],
});
export const { fontFamily: bodyFamily } = loadAssistant("normal", {
  weights: ["400", "600", "700"],
  subsets: ["hebrew", "latin"],
});

// Brand book palette (ספר מותג — לב ים) + the site's derived tokens (css/styles.css).
export const C = {
  bg: "#fff7ea", // cream
  card: "#ffffff",
  text: "#1a3340", // ink
  muted: "#4a6571", // ink-soft
  orange: "#f49834",
  orangeDeep: "#d97f1f",
  blue: "#2c92bf",
  blueDeep: "#1f6f93",
  border: "#e8d9b8", // line
  track: "#f3e6cc",
  icon: "#4a6571",
};

// Platform UI safe zone for 1080x1920 vertical video.
export const SAFE = { top: 150, bottom: 170, side: 60 };
export const SAFE_WIDTH = 1080 - SAFE.side * 2;

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

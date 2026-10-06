import type { TransitionTiming } from "@remotion/transitions";
import { Easing, interpolate } from "remotion";
import { clamp } from "../theme";

// Hands a presentation plain time (0→1 across the cut). Each presentation splits that time into
// phases and eases every one of them itself — nothing on screen moves linearly.
export const clock = (durationInFrames: number): TransitionTiming => ({
  getDurationInFrames: () => durationInFrames,
  getProgress: ({ frame }) => Math.min(1, Math.max(0, frame / durationInFrames)),
});

// 0→1 while t runs from `from` to `to`, eased.
export const phase = (t: number, from: number, to: number, easing: (x: number) => number) =>
  interpolate(t, [from, to], [0, 1], { ...clamp, easing });

export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
// Gentle ease-in: slow start, ends at twice the average speed — zooms finish without a snap.
export const IN = Easing.bezier(0.45, 0, 0.75, 0.5);
export const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const SWEEP = Easing.bezier(0.45, 0.05, 0.55, 0.95); // even in-out, for a pass across the frame
export const BACK = Easing.bezier(0.34, 1.56, 0.64, 1); // overshoots, then settles

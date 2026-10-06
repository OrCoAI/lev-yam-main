// img/gallery/16.jpg is 1200×1600 (3:4). Covering a 9:16 frame by height scales it ×1.2 to a
// 1440×1920 stage, cropped 180px each side. Every live layer sits on that stage, so it moves
// with the push-in. Coordinates are measured on the photo and mapped through `at()`.
export const FIT = 1920 / 1600;
export const STAGE = { width: 1200 * FIT, height: 1600 * FIT, left: -180 } as const;

export const at = (x: number, y: number) => ({ x: x * FIT, y: y * FIT });

export const SUN = at(765, 500);
export const HORIZON_Y = 602 * FIT;

// Open water between the two figures and the reeds; the sun's glitter path runs 690–850.
export const WATER = [
  { x0: 175, x1: 300, y0: 606, y1: 640 },
  { x0: 580, x1: 920, y0: 606, y1: 642 },
] as const;
export const GLITTER_PATH = { x0: 690, x1: 850 } as const;

// 12s loop. The grade walks golden hour → hibiscus → lagoon → orchid → back to gold, so the
// last frame meets the first.
export const LOOP = 360;
export const STOPS = [0, 90, 180, 270, 360];
export const SKY_TOP = ["#7a3cff", "#ff2e88", "#00a6c7", "#9b2cff", "#7a3cff"];
export const SKY_LOW = ["#ffad33", "#ff6a5c", "#38f0c8", "#ff5cc8", "#ffad33"];
export const GLOW = ["#ffd27a", "#ff8fb1", "#8ff7e4", "#e3a2ff", "#ffd27a"];

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

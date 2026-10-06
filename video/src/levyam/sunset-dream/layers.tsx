import { lightLeak } from "@remotion/effects/light-leak";
import type React from "react";
import {
  CanvasImage,
  Interactive,
  type InteractivitySchema,
  interpolate,
  interpolateColors,
  random,
  Solid,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  at,
  clamp,
  GLITTER_PATH,
  GLOW,
  HORIZON_Y,
  LOOP,
  SKY_LOW,
  SKY_TOP,
  STAGE,
  STOPS,
  SUN,
  WATER,
} from "./geometry";

export const PHOTO = staticFile("site/sunset-pair.jpg");

const fill: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: STAGE.width, height: STAGE.height };

// Periodic motion is counted in whole cycles per LOOP so every layer returns to frame 0.
const wave = (frame: number, cycles: number, phase = 0) => Math.sin(2 * Math.PI * (frame * cycles / LOOP + phase));

// A second copy of the photo, masked to the open sky left of the pergola and above the two
// heads, drifting a few px: the clouds move while the people hold still.
export const DriftingClouds: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...fill,
        maskImage: `radial-gradient(ellipse ${400 * 1.2}px ${215 * 1.2}px at ${at(430, 330).x}px ${at(430, 330).y}px, black 55%, transparent 100%)`,
      }}
    >
      <CanvasImage
        src={PHOTO}
        width={STAGE.width}
        height={STAGE.height}
        fit="fill"
        style={{
          ...fill,
          translate: interpolate(frame, [0, LOOP], ["-18px 0px", "26px 0px"]),
        }}
      />
    </div>
  );
};

// Open sky only, in photo px: fades out above the two heads, and cuts out the pergola beams (top
// right), the post (left) and the reeds (right) so they keep their own colour.
const SKY_MASK = (() => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600' preserveAspectRatio='none'>
<defs>
<linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0.26' stop-color='white'/><stop offset='0.355' stop-color='black'/></linearGradient>
<filter id='b'><feGaussianBlur stdDeviation='14'/></filter>
<mask id='m'><g filter='url(#b)'>
<rect width='1200' height='1600' fill='url(#g)'/>
<polygon fill='black' points='470,0 470,190 800,270 1060,330 1200,330 1200,0'/>
<rect fill='black' x='0' y='0' width='110' height='660'/>
<polygon fill='black' points='915,330 1010,300 1200,300 1200,760 890,760'/>
</g></mask>
</defs>
<rect width='1200' height='1600' fill='white' mask='url(#m)'/>
</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

// The grade: a `color` wash re-hues the sky only (luminance stays the photo's), and a soft-light
// layer carries a weaker version of the same hue over everything, people included.
export const SkyWash: React.FC = () => {
  const frame = useCurrentFrame();
  const top = interpolateColors(frame, STOPS, SKY_TOP);
  const low = interpolateColors(frame, STOPS, SKY_LOW);
  return (
    <>
      <div
        style={{
          ...fill,
          background: `linear-gradient(to bottom, ${top} 0px, ${low} ${HORIZON_Y - 60}px, ${low} ${HORIZON_Y}px)`,
          mixBlendMode: "color",
          opacity: 0.62,
          maskImage: SKY_MASK,
          maskSize: "100% 100%",
        }}
      />
      <div
        style={{
          ...fill,
          // Below the horizon the hue is pulled toward coral so skin never goes green or grey.
          background: `linear-gradient(to bottom, ${top}, ${low} 40%, color-mix(in srgb, ${top} 45%, #ff8a5c) 70%)`,
          mixBlendMode: "soft-light",
          opacity: 0.4,
        }}
      />
    </>
  );
};

const RAYS = (() => {
  const stops: string[] = [];
  let deg = 0;
  for (let i = 0; deg < 352; i++) {
    const gap = 6 + random(`ray-gap-${i}`) * 16;
    const width = 2 + random(`ray-w-${i}`) * 7;
    const a = (0.25 + random(`ray-a-${i}`) * 0.5).toFixed(2);
    stops.push(`transparent ${deg + gap}deg`, `rgba(255,255,255,${a}) ${deg + gap + width / 2}deg`, `transparent ${deg + gap + width}deg`);
    deg += gap + width;
  }
  return `conic-gradient(from 0deg, transparent 0deg, ${stops.join(", ")}, transparent 360deg)`;
})();

export const GodRays: React.FC = () => {
  const frame = useCurrentFrame();
  const size = 3000;
  return (
    <div
      style={{
        ...fill,
        overflow: "hidden",
        mixBlendMode: "screen",
        maskImage: `linear-gradient(to bottom, black 0px, black ${HORIZON_Y - 160}px, rgba(0,0,0,0.25) ${HORIZON_Y + 40}px, transparent ${HORIZON_Y + 260}px)`,
        opacity: interpolate(wave(frame, 2), [-1, 1], [0.32, 0.6]),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: SUN.x - size / 2,
          top: SUN.y - size / 2,
          width: size,
          height: size,
          maskImage: "radial-gradient(circle, black 3%, rgba(0,0,0,0.55) 14%, transparent 42%)",
          filter: "blur(7px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: `color-mix(in srgb, ${interpolateColors(frame, STOPS, GLOW)} 60%, white)`,
            maskImage: RAYS,
            rotate: interpolate(frame, [0, LOOP], ["0deg", "18deg"]),
          }}
        />
      </div>
    </div>
  );
};

export const SunBloom: React.FC = () => {
  const frame = useCurrentFrame();
  const glow = interpolateColors(frame, STOPS, GLOW);
  const size = 950;
  return (
    <div
      style={{
        position: "absolute",
        left: SUN.x - size / 2,
        top: SUN.y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(255,251,240,0.9) 0%, color-mix(in srgb, ${glow} 70%, transparent) 8%, color-mix(in srgb, ${glow} 25%, transparent) 28%, transparent 62%)`,
        mixBlendMode: "screen",
        scale: interpolate(wave(frame, 3), [-1, 1], [0.92, 1.08]),
        opacity: interpolate(wave(frame, 3, 0.15), [-1, 1], [0.55, 0.82]),
      }}
    />
  );
};

// Glints are horizontal slivers, as sun on water is; two thirds fall on the sun's own path, and
// every fifth flares into a four-point star. The water is already near-white, so they are drawn
// opaque rather than screened — a screen of white on it barely shows.
const GLINTS = Array.from({ length: 170 }, (_, i) => {
  const onPath = random(`g-path-${i}`) < 0.66;
  const zone = random(`g-zone-${i}`) < 0.25 ? WATER[0] : WATER[1];
  const x0 = onPath ? GLITTER_PATH.x0 : zone.x0;
  const x1 = onPath ? GLITTER_PATH.x1 : zone.x1;
  const y0 = onPath ? WATER[1].y0 : zone.y0;
  const y1 = onPath ? WATER[1].y1 : zone.y1;
  const depth = random(`g-y-${i}`);
  return {
    ...at(x0 + random(`g-x-${i}`) * (x1 - x0), y0 + depth * (y1 - y0)),
    // Nearer the shore, bigger glints.
    size: 1.4 + random(`g-s-${i}`) * 2.6 * (0.5 + depth),
    star: i % 5 === 0,
    cycles: 8 + Math.floor(random(`g-c-${i}`) * 14),
    phase: random(`g-p-${i}`),
  };
});

const flare = (length: number, vertical: boolean): React.CSSProperties => ({
  position: "absolute",
  left: vertical ? -1 : -length / 2,
  top: vertical ? -length / 2 : -1,
  width: vertical ? 2 : length,
  height: vertical ? length : 2,
  background: `linear-gradient(${vertical ? "to bottom" : "to right"}, transparent, white, transparent)`,
});

export const WaterGlitter: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={fill}>
      {GLINTS.map((g, i) => {
        const on = Math.max(0, wave(frame, g.cycles, g.phase)) ** 4;
        return (
          <div key={i} style={{ position: "absolute", left: g.x, top: g.y, opacity: on }}>
            <div
              style={{
                position: "absolute",
                left: -g.size * 1.5,
                top: -g.size * 0.3,
                width: g.size * 3,
                height: g.size * 0.6,
                borderRadius: "50%",
                backgroundColor: "white",
                boxShadow: `0 0 ${g.size * 2}px ${g.size * 0.4}px rgba(255, 226, 160, 0.8)`,
              }}
            />
            {g.star ? (
              <>
                <div style={flare(g.size * 16 * on, false)} />
                <div style={flare(g.size * 8 * on, true)} />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const BOKEH = Array.from({ length: 24 }, (_, i) => ({
  x: random(`b-x-${i}`) * 1080,
  size: 26 + random(`b-s-${i}`) ** 2 * 120,
  start: random(`b-y-${i}`),
  laps: 1 + Math.floor(random(`b-l-${i}`) * 2),
  sway: 20 + random(`b-w-${i}`) * 50,
  hueOffset: Math.floor(random(`b-h-${i}`) * LOOP),
  alpha: 0.18 + random(`b-a-${i}`) * 0.32,
}));

export const Bokeh: React.FC = () => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  return (
    <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
      {BOKEH.map((b, i) => {
        const travel = height + b.size * 2;
        const y = height + b.size - (((b.start + (frame * b.laps) / LOOP) % 1) * travel);
        const color = interpolateColors((frame + b.hueOffset) % LOOP, STOPS, GLOW);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.x - b.size / 2 + b.sway * wave(frame, b.laps * 2, b.start),
              top: y - b.size / 2,
              width: b.size,
              height: b.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${color} 0%, color-mix(in srgb, ${color} 45%, transparent) 45%, transparent 70%)`,
              filter: `blur(${b.size / 14}px)`,
              opacity: b.alpha,
            }}
          />
        );
      })}
    </div>
  );
};

type GullProps = {
  readonly y: number;
  readonly size: number;
  readonly flapsPerSecond: number;
  readonly style?: React.CSSProperties;
};

// One gull crosses the stage right → left over its sequence's duration.
const GullInner: React.FC<GullProps> = ({ y, size, flapsPerSecond, style }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const tip = -5 - 11 * Math.sin((2 * Math.PI * frame * flapsPerSecond) / fps);
  const x = interpolate(frame, [0, durationInFrames], [STAGE.width + size, -size]);
  return (
    <svg
      viewBox="-40 -30 80 60"
      width={size}
      height={size * 0.75}
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size * 0.375 + 12 * Math.sin((frame / fps) * 1.4),
        overflow: "visible",
        ...style,
      }}
    >
      <path
        d={`M -34 ${tip} Q -17 ${-12 + tip * 0.35} 0 2 Q 17 ${-12 + tip * 0.35} 34 ${tip}`}
        fill="none"
        stroke="#2a1430"
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const gullSchema = {
  y: { type: "number", default: 260, min: 0, max: 900, step: 1, description: "Height on the photo (px)", hiddenFromList: false },
  size: { type: "number", default: 70, min: 20, max: 200, step: 1, description: "Wingspan (px)", hiddenFromList: false },
  flapsPerSecond: { type: "number", default: 2.4, min: 0.5, max: 6, step: 0.1, description: "Flaps per second", hiddenFromList: false },
} as const satisfies InteractivitySchema;

export const Gull = Interactive.withSchema({
  Component: GullInner,
  componentName: "<Gull>",
  schema: gullSchema,
  wrapInSequence: true,
});

type LightLeakProps = {
  readonly seed: number;
  readonly hueShift: number;
  readonly style?: React.CSSProperties;
};

const LightLeakInner: React.FC<LightLeakProps> = ({ seed, hueShift, style }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  return (
    <Solid
      width={width}
      height={height}
      style={{ mixBlendMode: "screen", opacity: 0.5, ...style }}
      effects={[
        lightLeak({
          seed,
          hueShift,
          progress: interpolate(frame, [0, durationInFrames - 1], [0, 1], clamp),
        }),
      ]}
    />
  );
};

// In @remotion/effects 4.0.533 hueShift turns the other way from its docs: 0 gold, 60 hibiscus,
// 120 orchid, 180 blue, 240 turquoise, 300 lime. At mid-progress a leak floods the whole frame, hence
// the 0.5 opacity.
const lightLeakSchema = {
  seed: { type: "number", default: 0, min: 0, max: 100, step: 1, description: "Pattern", hiddenFromList: false },
  hueShift: { type: "number", default: 0, min: 0, max: 360, step: 1, description: "Hue shift", hiddenFromList: false },
} as const satisfies InteractivitySchema;

export const LightLeak = Interactive.withSchema({
  Component: LightLeakInner,
  componentName: "<LightLeak>",
  schema: lightLeakSchema,
  wrapInSequence: true,
});

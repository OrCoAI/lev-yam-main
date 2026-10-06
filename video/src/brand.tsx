import type React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, fontFamily } from "./theme";

/** The brand book's zigzag wave line. `progress` draws it in; it drifts like water. */
export const Zigzag: React.FC<{
  readonly width: number;
  readonly color: string;
  readonly period?: number;
  readonly amp?: number;
  readonly stroke?: number;
  readonly progress?: number;
  readonly speed?: number;
  readonly style?: React.CSSProperties;
}> = ({ width, color, period = 56, amp = 22, stroke = 6, progress = 1, speed = 1.2, style }) => {
  const frame = useCurrentFrame();
  const shift = (frame * speed) % period;
  const pts: string[] = [];
  for (let i = -2; i * (period / 2) <= width + period * 2; i++) {
    pts.push(`${i * (period / 2) - shift},${i % 2 === 0 ? amp : 0}`);
  }
  return (
    <svg
      width={width}
      height={amp + stroke * 2}
      viewBox={`0 ${-stroke} ${width} ${amp + stroke * 2}`}
      style={{ overflow: "hidden", clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)`, ...style }}
    >
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const stampPath = (w: number, h: number, tooth: number, amp: number) => {
  const side = (len: number, at: (t: number, off: number) => [number, number]) => {
    const n = Math.max(2, Math.round(len / tooth));
    return new Array(n).fill(0).map((_, k) => at((k / n) * len, k % 2 === 0 ? 0 : amp));
  };
  const pts = [
    ...side(w, (t, o) => [t, -o]),
    ...side(h, (t, o) => [w + o, t]),
    ...side(w, (t, o) => [w - t, h + o]),
    ...side(h, (t, o) => [-o, h - t]),
  ];
  return `M${pts.map(([x, y]) => `${x},${y}`).join(" L")} Z`;
};

/** Postage-stamp frame with a zigzag edge, as on the brand's business cards and logo. */
export const StampFrame: React.FC<{
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly fill?: string;
  readonly progress?: number;
  readonly tooth?: number;
  readonly amp?: number;
}> = ({ width, height, color, fill = C.card, progress = 1, tooth = 22, amp = 11 }) => (
  <svg
    width={width}
    height={height}
    style={{ position: "absolute", inset: 0, overflow: "visible", filter: "drop-shadow(0 6px 18px rgba(26,51,64,0.10))" }}
  >
    <path d={stampPath(width, height, tooth, amp)} fill={fill} fillOpacity={Math.min(1, progress * 2)} stroke="none" />
    <path
      d={stampPath(width, height, tooth, amp)}
      fill="none"
      stroke={color}
      strokeWidth={5}
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

/** The two-tone wordmark: לֵב in blue, יָם in orange (brand book, "משולב"). */
export const Wordmark: React.FC<{ readonly size: number; readonly style?: React.CSSProperties }> = ({ size, style }) => (
  <div style={{ fontFamily, fontWeight: 800, fontSize: size, lineHeight: 1.15, display: "flex", gap: size * 0.22, ...style }}>
    <span style={{ color: C.blue }}>לֵב</span>
    <span style={{ color: C.orange }}>יָם</span>
  </div>
);

export const BrandImg: React.FC<{ readonly file: string; readonly style?: React.CSSProperties }> = ({ file, style }) => (
  <Img src={staticFile(file)} style={{ position: "absolute", ...style }} />
);

/** Sun disc rising + palm swaying — the logo mark, assembled from the brand icons. */
export const PalmSun: React.FC<{ readonly size: number; readonly delay?: number }> = ({ size, delay = 0 }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const rise = interpolate(frame, [0, fps * 0.9], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const grow = interpolate(frame, [4, fps * 0.8], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const sway = Math.sin(frame / 14) * 2.5;
  const palmH = size;
  const palmW = (palmH * 613) / 951;
  const sun = size * 0.62;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <BrandImg
        file="site/icons/sun-orange.png"
        style={{
          width: sun,
          height: sun,
          left: size * 0.5 - sun * 0.5 + size * 0.04,
          top: size * 0.02 + (1 - rise) * size * 0.25,
          opacity: rise,
          rotate: `${frame * 0.3}deg`,
        }}
      />
      <BrandImg
        file="brand/palm-blue.png"
        style={{
          width: palmW,
          height: palmH,
          left: size * 0.5 - palmW * 0.5,
          top: 0,
          transformOrigin: "50% 100%",
          scale: `1 ${grow}`,
          rotate: `${sway}deg`,
        }}
      />
    </div>
  );
};

/** Paper grain — the brand's hand-cut, printed feel. */
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "multiply", opacity: 0.09 }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={Math.floor(frame / 2)} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Scene-change overlay: an orange band with zigzag edges, led by a blue one, sweeps right→left. */
export const BandSweep: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const BAND = 1400;
  const LEAD = 140;
  const total = 1080 + BAND + LEAD * 2 + 60;
  const x = interpolate(frame, [0, durationInFrames], [1080 + 30, 1080 - total], {
    ...clamp,
    easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  });
  const band = (left: number, width: number, color: string) => (
    <svg style={{ position: "absolute", left, top: 0 }} width={width + 40} height={1920} viewBox={`-20 0 ${width + 40} 1920`}>
      <path d={edgePath(width, 1920, 64, 20)} fill={color} />
    </svg>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {band(x, LEAD, C.blue)}
      {band(x + LEAD - 10, BAND, C.orange)}
      {band(x + LEAD + BAND - 20, LEAD, C.blue)}
    </AbsoluteFill>
  );
};

const edgePath = (w: number, h: number, tooth: number, amp: number) => {
  const n = Math.round(h / tooth);
  const right: string[] = [];
  const left: string[] = [];
  for (let k = 0; k <= n; k++) {
    const y = (k / n) * h;
    right.push(`${w + (k % 2 ? amp : 0)},${y}`);
    left.push(`${k % 2 ? -amp : 0},${h - y}`);
  }
  return `M0,0 L${right.join(" L")} L${left.join(" L")} Z`;
};

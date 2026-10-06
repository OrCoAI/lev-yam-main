import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { C, clamp } from "../theme";
import { OUT, SWEEP, phase } from "./timing";

const TOOTH = 72; // one zigzag period, top to bottom — the logo's wave, stood on end
const AMP = 28;
const ORANGE = 110; // band widths, ahead of the incoming scene's edge
const CREAM = 44;
const X0 = 1400; // edge start: bands and palms just off-frame right
const X1 = -320; // edge end: palms gone off-frame left

const edge = (x: number) =>
  new Array(Math.ceil(1920 / (TOOTH / 2)) + 1)
    .fill(0)
    .map((_, k) => [x + (k % 2 ? AMP : 0), k * (TOOTH / 2)] as const);

const band = (left: number, right: number) => {
  const a = edge(left);
  const b = edge(right).reverse();
  return `M ${[...a, ...b].map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
};

// Zigzag-edged bands wash across right → left like a wave, palms riding the crest; the next
// scene follows behind the wave's trailing edge.
const WaveWash: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress: t,
}) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const x = interpolate(phase(t, 0, 1, SWEEP), [0, 1], [X0, X1], clamp);
  const sway = phase(t, 0, 1, OUT);
  const scene = `polygon(${[...edge(x), [2000, 1920] as const, [2000, 0] as const].map(([px, py]) => `${px}px ${py}px`).join(", ")})`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: scene }}>{children}</AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={band(x - ORANGE - CREAM, x - CREAM + 2)} fill={C.orange} />
        <path d={band(x - CREAM, x + 2)} fill={C.cream} />
      </svg>
      <Img
        src={staticFile("brand/palm-cream.png")}
        style={{
          position: "absolute",
          left: x - 130 - 265,
          top: 1920 - 820 + 40,
          width: 530,
          height: 820,
          transformOrigin: "50% 100%",
          rotate: `${interpolate(sway, [0, 1], [-10, 4], clamp)}deg`,
        }}
      />
      <Img
        src={staticFile("site/icons/palm-orange.png")}
        style={{
          position: "absolute",
          left: x + 90 - 200,
          top: 1920 - 620 + 60,
          width: 400,
          height: 620,
          transformOrigin: "50% 100%",
          rotate: `${interpolate(sway, [0, 1], [-14, 6], clamp)}deg`,
        }}
      />
    </AbsoluteFill>
  );
};

export const waveWash = (): TransitionPresentation<Record<string, never>> => ({
  component: WaveWash,
  props: {},
});

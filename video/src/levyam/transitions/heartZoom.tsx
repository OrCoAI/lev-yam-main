import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { BACK, IN, IN_OUT, phase } from "./timing";

// heart.png is 440×400; its cream square is a diamond with corners (218,57) (376,219)
// (220,382) (57,211), measured from the pixels.
const PNG = { w: 440, h: 400 };
const DIAMOND = [
  [218, 57],
  [376, 219],
  [220, 382],
  [57, 211],
] as const;
const CX = 216.5;
const CY = 219.5;
const K = 1.2; // a 528px-wide heart
const Z = 14; // the diamond covers the frame from AT once K·z ≥ 10.4 — a few frames before the end
const AT = { x: 540, y: 790 }; // over the aerial card, and where the end card's logo sits

// לב = heart. The brand heart pops in and beats twice, then the camera dives into its cream
// square, which becomes the end card's cream background.
const HeartZoom: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress: t,
}) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const pop = phase(t, 0, 0.16, BACK);
  const lub = Math.sin(Math.PI * phase(t, 0.16, 0.26, IN_OUT)) * 0.16;
  const dub = Math.sin(Math.PI * phase(t, 0.27, 0.37, IN_OUT)) * 0.1;
  const dive = phase(t, 0.38, 0.97, IN);
  const z = pop * (1 + lub + dub) * Math.pow(Z, dive);
  const s = K * z;
  const diamond = DIAMOND.map(([px, py]) => `${AT.x + (px - CX) * s}px ${AT.y + (py - CY) * s}px`).join(", ");
  return (
    <AbsoluteFill>
      <Img
        src={staticFile("site/icons/heart.png")}
        style={{
          position: "absolute",
          left: AT.x - CX * K,
          top: AT.y - CY * K,
          width: PNG.w * K,
          height: PNG.h * K,
          transformOrigin: `${CX * K}px ${CY * K}px`,
          scale: z,
        }}
      />
      <AbsoluteFill style={{ clipPath: `polygon(${diamond})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const heartZoom = (): TransitionPresentation<Record<string, never>> => ({
  component: HeartZoom,
  props: {},
});

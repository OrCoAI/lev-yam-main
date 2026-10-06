import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { BACK, IN, phase } from "./timing";

// house-orange.png is 469×310; its arched windows are transparent holes at x 108–195 and
// 251–338, y 142–286 (measured from the alpha channel). The clips run 3px wider so the hand-cut
// edge of a hole never shows a sliver of the outgoing scene. The camera dives through the right
// one — where RTL reading starts.
const PNG = { w: 469, h: 310 };
const WIN = { left: 248, right: 341, top: 139, bottom: 289 };
const WIN_LEFT = { left: 105, right: 198 };
const WX = (WIN.left + WIN.right) / 2;
const WY = (WIN.top + WIN.bottom) / 2;
const K = 1.32; // a 620px-wide house
const Z = 20; // the arch clears every corner of the frame once K·z ≥ 17 — a few frames before the end
const AT = { x: 540, y: 960 }; // the window's centre stays put; the house grows around it

// The site's house icon pops up, then the camera pushes through its window into the next scene.
const HouseWindow: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress: t,
}) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const pop = phase(t, 0, 0.26, BACK);
  const push = phase(t, 0.24, 1, IN);
  const z = pop * Math.pow(Z, push);
  const s = K * z;
  const T = AT.y + (WIN.top - WY) * s;
  const B = AT.y + (WIN.bottom - WY) * s;
  // Both windows look into the next scene: an arch per window, one clip path.
  const arch = (left: number, right: number) => {
    const L = AT.x + (left - WX) * s;
    const R = AT.x + (right - WX) * s;
    const r = (R - L) / 2;
    return `M ${L} ${B} L ${L} ${T + r} A ${r} ${r} 0 0 1 ${R} ${T + r} L ${R} ${B} Z`;
  };
  return (
    <AbsoluteFill>
      <Img
        src={staticFile("brand/house-orange.png")}
        style={{
          position: "absolute",
          left: AT.x - WX * K,
          top: AT.y - WY * K,
          width: PNG.w * K,
          height: PNG.h * K,
          transformOrigin: `${WX * K}px ${WY * K}px`,
          scale: z,
        }}
      />
      <AbsoluteFill
        style={{ clipPath: `path("${arch(WIN.left, WIN.right)} ${arch(WIN_LEFT.left, WIN_LEFT.right)}")` }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const houseWindow = (): TransitionPresentation<Record<string, never>> => ({
  component: HouseWindow,
  props: {},
});

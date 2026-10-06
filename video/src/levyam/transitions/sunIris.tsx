import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp } from "../theme";
import { IN, IN_OUT, phase } from "./timing";

type SunIrisProps = {
  // Where the sun enters, and where it lands — on the sun in the next scene's photo.
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
};

const DISC = 120;
const OPEN = 1780; // reaches the far corner of the frame from where the sun lands

// The brand's sun rolls in from the right, settles on the photo's sun, and the next scene
// opens inside it, rimmed in orange.
const SunIris: React.FC<TransitionPresentationComponentProps<SunIrisProps>> = ({
  children,
  presentationDirection,
  presentationProgress: t,
  passedProps: { from, to },
}) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const roll = phase(t, 0, 0.55, IN_OUT);
  const open = phase(t, 0.45, 0.97, IN);
  const cx = interpolate(roll, [0, 1], [from[0], to[0]], clamp);
  const cy = interpolate(roll, [0, 1], [from[1], to[1]], clamp);
  const r = open * OPEN;
  const rim = Math.max(DISC, r * 1.06 + 18);
  return (
    <AbsoluteFill>
      <Img
        src={staticFile("site/icons/sun-orange.png")}
        style={{
          position: "absolute",
          left: cx - rim,
          top: cy - rim,
          width: rim * 2,
          height: rim * 2,
          rotate: `${-360 * roll}deg`,
        }}
      />
      <AbsoluteFill style={{ clipPath: `circle(${r}px at ${cx}px ${cy}px)` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const sunIris = (props: SunIrisProps): TransitionPresentation<SunIrisProps> => ({
  component: SunIris,
  props,
});

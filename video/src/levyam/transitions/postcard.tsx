import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, interpolate } from "remotion";
import { StampFrame } from "../../brand";
import { C, clamp } from "../theme";
import { IN, OUT, phase } from "./timing";

const M = 64; // stamp border around the scene, in scene pixels — off-frame until it shrinks

// The outgoing scene lifts into a zigzag-edged postage stamp (the brand's business-card frame)
// and flies off to the left; the next scene is underneath, settling from a slight push-in.
const Postcard: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress: t,
}) => {
  if (presentationDirection === "entering") {
    return (
      <AbsoluteFill style={{ scale: interpolate(t, [0, 1], [1.1, 1], { ...clamp, easing: OUT }) }}>
        {children}
      </AbsoluteFill>
    );
  }
  const lift = phase(t, 0, 0.45, OUT);
  const fly = phase(t, 0.35, 1, IN);
  return (
    <AbsoluteFill
      style={{
        zIndex: 1,
        translate: `${interpolate(fly, [0, 1], [0, -1500], clamp)}px ${interpolate(fly, [0, 1], [0, -160], clamp)}px`,
        rotate: `${interpolate(lift, [0, 1], [0, -6], clamp) + interpolate(fly, [0, 1], [0, -14], clamp)}deg`,
        scale: interpolate(lift, [0, 1], [1, 0.56], clamp),
      }}
    >
      <div style={{ position: "absolute", left: -M, top: -M, width: 1080 + 2 * M, height: 1920 + 2 * M }}>
        <StampFrame width={1080 + 2 * M} height={1920 + 2 * M} color={C.orange} fill={C.cream} tooth={48} amp={22} />
      </div>
      <AbsoluteFill style={{ overflow: "hidden" }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const postcard = (): TransitionPresentation<Record<string, never>> => ({
  component: Postcard,
  props: {},
});

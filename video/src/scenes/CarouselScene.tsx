import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ReviewProps } from "../data";
import { C, clamp } from "../theme";
import { ReviewSlide } from "./ReviewSlide";

// 105 + 105 + 100 − 2 × 15 (slide overlap) = 280 frames.
const SLIDE_FRAMES = 15;
// Frame at which each slide is the one mostly on screen (mid-transition).
const SWITCH_AT = [97, 187];

const Dots: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top: 1600,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        gap: 18,
        direction: "rtl",
      }}
    >
      {[0, 1, 2].map((i) => {
        const ramp = (at: number) => interpolate(frame, [at - 6, at + 6], [0, 1], clamp);
        const active = (i === 0 ? 1 : ramp(SWITCH_AT[i - 1])) - (i < 2 ? ramp(SWITCH_AT[i]) : 0);
        return (
          <div
            key={i}
            style={{
              width: 22 + active * 34,
              height: 22,
              borderRadius: 11,
              background: active > 0.5 ? C.orange : C.border,
            }}
          />
        );
      })}
    </div>
  );
};

export const CarouselScene: React.FC<ReviewProps> = ({ reviews }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Review 1" durationInFrames={105} premountFor={fps}>
          <ReviewSlide {...reviews[0]} graphic="bars" frameColor={C.orange} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: SLIDE_FRAMES })}
        />
        <TransitionSeries.Sequence name="Review 2" durationInFrames={105} premountFor={fps}>
          <ReviewSlide {...reviews[1]} graphic="heart" frameColor={C.blue} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: SLIDE_FRAMES })}
        />
        <TransitionSeries.Sequence name="Review 3" durationInFrames={100} premountFor={fps}>
          <ReviewSlide {...reviews[2]} graphic="house" frameColor={C.orange} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Dots />
    </AbsoluteFill>
  );
};

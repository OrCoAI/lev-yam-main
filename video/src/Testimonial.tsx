import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { BandSweep, Grain } from "./brand";
import { CarouselScene } from "./scenes/CarouselScene";
import { CtaScene } from "./scenes/CtaScene";
import { HookScene } from "./scenes/HookScene";
import { RatingScene } from "./scenes/RatingScene";
import { StackScene } from "./scenes/StackScene";
import { SafeZone } from "./levyam/SafeZone";
import type { ReviewProps } from "./data";

// Scene changes are brand band sweeps (overlays — they don't shorten the timeline):
// 90 + 90 + 280 + 85 + 55 = 600 frames = 20s @ 30fps.
// `reviews` arrive from the composition's `calculateMetadata` (`loadReviews` in data.ts).
export const Testimonial: React.FC<ReviewProps> = ({ reviews }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Hook" durationInFrames={90} premountFor={fps}>
          <HookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={22} premountFor={fps}>
          <BandSweep />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence name="Rating" durationInFrames={90} premountFor={fps}>
          <RatingScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={22} premountFor={fps}>
          <BandSweep />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence name="Reviews" durationInFrames={280} premountFor={fps}>
          <CarouselScene reviews={reviews} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={22} premountFor={fps}>
          <BandSweep />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence name="Social proof" durationInFrames={85} premountFor={fps}>
          <StackScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={22} premountFor={fps}>
          <BandSweep />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence name="CTA" durationInFrames={55} premountFor={fps}>
          <CtaScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Grain />
      <SafeZone />
    </AbsoluteFill>
  );
};

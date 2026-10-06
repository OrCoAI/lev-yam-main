import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { CtaBeat } from "./beats/CtaBeat";
import { HookBeat } from "./beats/HookBeat";
import { WhatBeat } from "./beats/WhatBeat";
import { WhenBeat } from "./beats/WhenBeat";
import { WhereBeat } from "./beats/WhereBeat";
import { WhoBeat } from "./beats/WhoBeat";
import type { WeekendReelProps } from "./schema";
import { C, TYPE } from "./theme";
import { SafeZone } from "./SafeZone";
import { heartZoom } from "./transitions/heartZoom";
import { houseWindow } from "./transitions/houseWindow";
import { postcard } from "./transitions/postcard";
import { sunIris } from "./transitions/sunIris";
import { clock } from "./transitions/timing";
import { waveWash } from "./transitions/waveWash";

// Cuts at 90 / 210 / 330 / 426 / 512, each a 0.5s (15-frame) transition from 7 frames before
// its cut: 98 + 135 + 135 + 111 + 101 + 95 − 5 × 15 = 600 frames = 20s @ 30fps.
// Every cut is built from the site's own icons and moves right → left or dives through a
// shape — never a fade between text beats.
export const WeekendReel: React.FC<WeekendReelProps> = (copy) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      dir="rtl"
      lang={copy.lang}
      style={{ backgroundColor: C.ink, textAlign: "start", fontFamily: TYPE[copy.lang].body }}
    >
      <TransitionSeries>
        <TransitionSeries.Sequence name="Hook" durationInFrames={98} premountFor={fps}>
          <HookBeat copy={copy} duration={98} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={sunIris({ from: [1180, 980], to: [256, 615] })}
          timing={clock(15)}
        />
        <TransitionSeries.Sequence name="When" durationInFrames={135} premountFor={fps}>
          <WhenBeat copy={copy} duration={135} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={postcard()} timing={clock(15)} />
        <TransitionSeries.Sequence name="What" durationInFrames={135} premountFor={fps}>
          <WhatBeat copy={copy} duration={135} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={houseWindow()} timing={clock(15)} />
        <TransitionSeries.Sequence name="Who" durationInFrames={111} premountFor={fps}>
          <WhoBeat copy={copy} duration={111} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={waveWash()} timing={clock(15)} />
        <TransitionSeries.Sequence name="Where" durationInFrames={101} premountFor={fps}>
          <WhereBeat copy={copy} duration={101} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={heartZoom()} timing={clock(15)} />
        <TransitionSeries.Sequence name="CTA" durationInFrames={95} premountFor={fps}>
          <CtaBeat copy={copy} duration={95} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <SafeZone />
    </AbsoluteFill>
  );
};

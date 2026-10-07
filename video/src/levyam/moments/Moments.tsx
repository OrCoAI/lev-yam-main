import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Accent, KenBurns, Rise, Scrim, SignOff, SunDot, Words, ZoneBlock } from "../parts";
import { SafeZone } from "../SafeZone";
import { C, TYPE, body, headline, hero, type Type } from "../theme";
import { heartZoom } from "../transitions/heartZoom";
import { clock } from "../transitions/timing";
import type { MomentsProps } from "./schema";

// video/briefs/moments-by-the-sea.md: 66 + 54 + 60 + 75 − 15 (heartZoom) = 240 frames = 8s @ 30fps.
// Hard cuts between the three moments (adjacent sequences, no transition); the brand heart only
// into the sign-off. Only shot 1 differs between hooks.
const HOOK = 66;
const FOOD = 54;
const SUNSET = 60;
const END = 75;
const HEART = 15;
export const MOMENTS_FRAMES = HOOK + FOOD + SUNSET + END - HEART;

type Beat = { readonly copy: MomentsProps; readonly t: Type };

type PhotoBeatProps = {
  readonly src: string;
  readonly duration: number;
  readonly crop: string;
  readonly to: number;
  readonly children: React.ReactNode;
};

// A moment: the photo pushing in (the sources are ~3:4, so in 9:16 `crop` only shifts sideways;
// its y sets where the push-in closes in), a bottom scrim, the caption at the bottom of the text zone.
// The scrim reaches well past ZONE's bottom edge (y 1248 ≈ 65% down).
const PhotoBeat: React.FC<PhotoBeatProps> = ({ src, duration, crop, to, children }) => (
  <AbsoluteFill>
    <KenBurns src={src} duration={duration} crop={crop} to={to} />
    <Scrim side="bottom" reach={85} />
    <ZoneBlock anchor="bottom">{children}</ZoneBlock>
  </AbsoluteFill>
);

// Shot 1's text. footage: motion only for frames 0–14, then the work line. name: the name is
// mid-rise on frame 0. place: the first word has landed on frame 0, the second is rising.
// Never the logo here (guidelines §7).
const HookText: React.FC<Beat> = ({ copy, t }) => {
  switch (copy.hook) {
    case "footage":
      return (
        <>
          <Words text={copy.work} start={15} stagger={8} style={headline(t, C.cream)} />
          <Accent start={36} />
        </>
      );
    case "name":
      return (
        <>
          <Words text={copy.name} start={-8} style={hero(t, C.cream)} />
          <Accent start={14} />
        </>
      );
    case "place":
      return (
        <>
          <Words text={copy.village} start={-18} stagger={10} style={headline(t, C.cream)} />
          <Accent start={18} />
          <Words text={copy.area} start={22} stagger={8} style={body(t, C.cream)} />
        </>
      );
  }
};

// Shot 4. Sign-off, no ask (the brief's §7 exception). Settled by local frame 28 (global 193),
// so 195–239 is a still frame. Lifted 60px so the place line ends above ZONE's y 1248.
const EndBeat: React.FC<Beat> = ({ copy, t }) => (
  <SignOff t={t} title={copy.name} lift={60}>
    <div style={{ ...body(t, C.inkSoft, false), marginTop: 12 }}>
      <Rise start={12}>{`${copy.village} · ${copy.area}`}</Rise>
    </div>
  </SignOff>
);

export const Moments: React.FC<MomentsProps> = (copy) => {
  const { fps } = useVideoConfig();
  const t = TYPE[copy.lang];
  return (
    <AbsoluteFill dir="rtl" lang={copy.lang} style={{ backgroundColor: C.ink, textAlign: "start", fontFamily: t.body }}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Hook" durationInFrames={HOOK} premountFor={fps}>
          <PhotoBeat src="site/work-window.jpg" duration={HOOK} crop="50% 40%" to={1.06}>
            <HookText copy={copy} t={t} />
          </PhotoBeat>
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Food" durationInFrames={FOOD} premountFor={fps}>
          {/* A 900px source upscaled ~1.6× — a gentler push. */}
          <PhotoBeat src="site/weekend-table.jpg" duration={FOOD} crop="50% 70%" to={1.05}>
            <Words text={copy.food} start={0} stagger={5} style={headline(t, C.cream)} />
          </PhotoBeat>
        </TransitionSeries.Sequence>
        <TransitionSeries.Sequence name="Sunset" durationInFrames={SUNSET} premountFor={fps}>
          <PhotoBeat src="site/sunset-pair.jpg" duration={SUNSET} crop="50% 30%" to={1.06}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <SunDot start={0} />
              <Words text={copy.sunset} start={0} stagger={5} style={headline(t, C.cream)} />
            </div>
          </PhotoBeat>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={heartZoom()} timing={clock(HEART)} />
        <TransitionSeries.Sequence name="End" durationInFrames={END} premountFor={fps}>
          <EndBeat copy={copy} t={t} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <SafeZone />
    </AbsoluteFill>
  );
};

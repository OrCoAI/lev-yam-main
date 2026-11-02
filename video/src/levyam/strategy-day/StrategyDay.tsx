import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Accent, KenBurns, MediaBeat, PhotoCard, Pill, Rise, SignOff, Words, ZoneBlock } from "../parts";
import { SafeZone } from "../SafeZone";
import { C, TYPE, body, headline, type Type } from "../theme";
import { heartZoom } from "../transitions/heartZoom";
import { postcard } from "../transitions/postcard";
import { clock } from "../transitions/timing";
import type { StrategyDayProps } from "./schema";

// video/briefs/strategy-day-by-the-sea.md: 90 + 210 + 90 − 15 (postcard) − 15 (heartZoom) = 360
// frames = 12s @ 30fps. The window shot lifts into a stamp; three postcards land on one cream deck, the caption hard-cutting at each; the brand heart into the ask. Only shot 1
// differs between hooks.
const HOOK = 90;
const DECK = 210;
const END = 90;
const CUT = 15;
export const STRATEGY_DAY_FRAMES = HOOK + DECK + END - 2 * CUT;

// Deck-local frames each postcard starts landing; its caption runs until the next one.
const GROUPS = 0;
const TABLE = 75;
const CIRCLE = 145;


type Beat = { readonly copy: StrategyDayProps; readonly t: Type };

// Shot 1's text. question: the first word has landed on frame 0, the second is rising.
// footage: motion only for frames 0–14, then the line. Never the logo here (guidelines §7).
const HookText: React.FC<Beat> = ({ copy, t }) => {
  const [text, start, stagger, accent] =
    copy.hook === "footage" ? [copy.footage, 15, 8, 36] : [copy.question, -18, 10, 30];
  return (
    <>
      <Words text={text} start={start} stagger={stagger} style={headline(t, C.cream)} />
      <Accent start={accent} />
    </>
  );
};

const Caption: React.FC<{ readonly text: string; readonly t: Type }> = ({ text, t }) => (
  <ZoneBlock anchor="bottom">
    <Words text={text} start={0} stagger={6} style={headline(t, C.ink, false)} />
  </ZoneBlock>
);

// Shots 2–4. The cards stay down as the next lands; the captions are hard cuts. The landscape
// cards are 950 wide (the 6% sides), the portrait one 620; all centred on y 520 — a photo may cross
// the top band, text never — so a caption at the bottom of ZONE clears the tallest card (the
// portrait, to y ≈ 901). The landscape cards land over it, its ends showing.
const Deck: React.FC<Beat> = ({ copy, t }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: C.cream }}>
      <Sequence name="Card · groups" from={GROUPS} premountFor={fps}>
        <PhotoCard src="photos/work-05.jpg" aspect={4 / 5} width={620} centerY={520} tilt={-2} start={0} />
      </Sequence>
      <Sequence name="Card · table" from={TABLE} premountFor={fps}>
        <PhotoCard src="site/offsite-table.jpg" aspect={16 / 9} width={950} centerY={520} tilt={1.5} start={0} />
      </Sequence>
      <Sequence name="Card · circle" from={CIRCLE} premountFor={fps}>
        <PhotoCard src="site/offsite-circle.jpg" aspect={16 / 9} width={950} centerY={520} tilt={-1} start={0} />
      </Sequence>
      {/* The first caption waits for the postcard transition to finish. */}
      <Sequence name="Caption · groups" from={CUT} durationInFrames={TABLE - CUT} premountFor={fps}>
        <Caption text={copy.groups} t={t} />
      </Sequence>
      <Sequence name="Caption · table" from={TABLE} durationInFrames={CIRCLE - TABLE} premountFor={fps}>
        <Caption text={copy.table} t={t} />
      </Sequence>
      <Sequence name="Caption · circle" from={CIRCLE} premountFor={fps}>
        <Caption text={copy.circle} t={t} />
      </Sequence>
    </AbsoluteFill>
  );
};

// Shot 5. The ask; everything has landed by local frame 45 (the Arabic line's 4th word: 14 + 3 × 5
// + 16), global 315, so 315–359 is a still frame. The Arabic title wraps to three lines at ZONE's
// width, so the logo is smaller (300) and the group lifted, keeping the phone pill above y 1248 —
// one layout for both languages (a ZONE-fitting end card is the brief's follow-up).
const EndBeat: React.FC<Beat> = ({ copy, t }) => (
  <SignOff t={t} title={copy.cta.headline} lift={220} logoSize={300} fitZone stagger={6}>
    <Words text={copy.cta.line} start={14} stagger={5} style={{ ...body(t, C.inkSoft, false), marginTop: 12 }} />
    <div style={{ marginTop: 32 }}>
      <Pill start={28}>
        <Rise start={28}>
          <bdi dir="ltr" style={{ fontFamily: t.body, fontSize: t.text, fontWeight: 600, color: C.ink }}>
            {copy.cta.phone}
          </bdi>
        </Rise>
      </Pill>
    </div>
  </SignOff>
);

export const StrategyDay: React.FC<StrategyDayProps> = (copy) => {
  const { fps } = useVideoConfig();
  const t = TYPE[copy.lang];
  return (
    <AbsoluteFill dir="rtl" lang={copy.lang} style={{ backgroundColor: C.ink, textAlign: "start", fontFamily: t.body }}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Hook" durationInFrames={HOOK} premountFor={fps}>
          {/* The one tall source (1200×1600): full-frame, pushing in toward the window. */}
          <MediaBeat media={<KenBurns src="site/offsite-window.jpg" duration={HOOK} crop="50% 45%" to={1.06} />}>
            <HookText copy={copy} t={t} />
          </MediaBeat>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={postcard()} timing={clock(CUT)} />
        <TransitionSeries.Sequence name="Deck" durationInFrames={DECK} premountFor={fps}>
          <Deck copy={copy} t={t} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={heartZoom()} timing={clock(CUT)} />
        <TransitionSeries.Sequence name="End" durationInFrames={END} premountFor={fps}>
          <EndBeat copy={copy} t={t} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <SafeZone />
    </AbsoluteFill>
  );
};

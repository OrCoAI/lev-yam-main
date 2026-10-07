import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { StarRow } from "../../icons";
import { Accent, Clip, KenBurns, MediaBeat, Pill, Rise, Scrim, SignOff, Words, ZoneBlock } from "../parts";
import { SafeZone } from "../SafeZone";
import { C, TYPE, body, caption, headline, type Type } from "../theme";
import { heartZoom } from "../transitions/heartZoom";
import { clock } from "../transitions/timing";
import type { Quote, TeamDayProps } from "./schema";

// video/briefs/team-day-guests.md: 90 + 84 + 84 + 60 + 60 + 60 + 75 + 102 − 15 (heartZoom) = 600
// frames = 20s @ 30fps. Hard cuts between beats; the brand heart only into the end card. Only
// shot 1 differs between hooks. The event footage and the quotes are private (gitignored).
const HOOK = 90;
const QUOTES = [84, 84, 60, 60, 60] as const;
const GROUP = 75;
const END = 102;
const HEART = 15;
const QUOTES_TOTAL = QUOTES.reduce((a, b) => a + b, 0);
export const TEAM_DAY_FRAMES = HOOK + QUOTES_TOTAL + GROUP + END - HEART;

const DIR = "private/team-day";
// The live-clip derivatives are 1744×1308 (4:3); stretched to fill their beat (85 → 90, 76 → 84 frames).
const CLIP_ASPECT = 4 / 3;

// Each quote's backdrop: the two clips and two stills of the same table, cropped differently.
const BACKDROPS: ReadonlyArray<(d: number) => React.ReactNode> = [
  () => <Clip name="Table, side" src={`${DIR}/table-wide.mp4`} aspect={CLIP_ASPECT} x={60} playbackRate={0.9} />,
  (d) => <KenBurns src={`${DIR}/table-03.jpg`} duration={d} crop="80% 50%" to={1.06} />,
  (d) => <KenBurns src={`${DIR}/table-04.jpg`} duration={d} crop="15% 50%" to={1.06} />,
  (d) => <KenBurns src={`${DIR}/table-04.jpg`} duration={d} crop="85% 50%" to={1.06} />,
  (d) => <KenBurns src={`${DIR}/table-03.jpg`} duration={d} crop="20% 50%" to={1.06} />,
];

type Beat = { readonly copy: TeamDayProps; readonly t: Type };

// Shot 1's text. footage: motion only for frames 0–14, then the line. question: on frame 0 the
// first word is nearly in and the second mid-rise (guidelines §7).
const HookText: React.FC<Beat> = ({ copy, t }) => {
  const [text, start, accent] = copy.hook === "footage" ? [copy.footage, 15, 36] : [copy.question, -14, 24];
  return (
    <>
      <Words text={text} start={start} stagger={8} style={headline(t, C.cream)} />
      <Accent start={accent} />
    </>
  );
};

// One guest's words: five stars, the quote, the neutral label (and, in Arabic, "translated").
// The block rises as one, fast — reading time, not a per-word reveal.
const QuoteText: React.FC<{ readonly q: Quote; readonly translated?: string; readonly t: Type }> = ({ q, translated, t }) => (
  <>
    <Rise start={0}>
      <StarRow size={44} />
    </Rise>
    <div style={body(t, C.cream)}>
      <Rise start={2}>{q.text}</Rise>
    </div>
    <div style={{ ...caption(t, C.cream), opacity: 0.85 }}>
      <Rise start={6}>
        {`— ${q.label}`}
        {translated ? ` · ${translated}` : ""}
      </Rise>
    </div>
  </>
);

// Shot 8. Settled by local frame 56 (the Arabic title's 5th word lands at 8 + 4 × 8 + 16); the
// last 45 frames (57–101) are still. Lifted so the phone pill ends above ZONE's y 1248.
const EndBeat: React.FC<Beat> = ({ copy, t }) => (
  <SignOff t={t} title={copy.cta.headline} lift={190} fitZone stagger={8}>
    <Words text={copy.cta.line} start={18} stagger={6} style={{ ...body(t, C.inkSoft, false), marginTop: 12 }} />
    <div style={{ marginTop: 32 }}>
      <Pill start={34}>
        <Rise start={34}>
          <bdi dir="ltr" style={{ fontFamily: t.body, fontSize: t.text, fontWeight: 600, color: C.ink }}>
            {copy.cta.phone}
          </bdi>
        </Rise>
      </Pill>
    </div>
  </SignOff>
);

export const TeamDay: React.FC<TeamDayProps> = (copy) => {
  const { fps } = useVideoConfig();
  const t = TYPE[copy.lang];
  return (
    <AbsoluteFill dir="rtl" lang={copy.lang} style={{ backgroundColor: C.ink, textAlign: "start", fontFamily: t.body }}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Hook" durationInFrames={HOOK} premountFor={fps}>
          <MediaBeat media={<Clip name="Table, sea" src={`${DIR}/table-sea.mp4`} aspect={CLIP_ASPECT} x={45} playbackRate={0.94} />}>
            <HookText copy={copy} t={t} />
          </MediaBeat>
        </TransitionSeries.Sequence>
        {QUOTES.map((d, i) => (
          <TransitionSeries.Sequence key={i} name={`Quote ${i + 1}`} durationInFrames={d} premountFor={fps}>
            <MediaBeat media={BACKDROPS[i](d)}>
              <QuoteText q={copy.quotes[i]} translated={copy.translated} t={t} />
            </MediaBeat>
          </TransitionSeries.Sequence>
        ))}
        <TransitionSeries.Sequence name="Group" durationInFrames={GROUP} premountFor={fps}>
          {/* The group stands in the lower half — the place line goes up in the sky, off their faces. */}
          <AbsoluteFill>
            <KenBurns src={`${DIR}/group.jpg`} duration={GROUP} crop="25% 50%" cropTo="75% 50%" to={1.04} />
            <Scrim side="top" reach={45} />
            <ZoneBlock anchor="top">
              <Words text={copy.village} start={0} stagger={8} style={headline(t, C.cream)} />
              <Words text={copy.area} start={10} stagger={8} style={body(t, C.cream)} />
            </ZoneBlock>
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={heartZoom()} timing={clock(HEART)} />
        <TransitionSeries.Sequence name="End" durationInFrames={END} premountFor={fps}>
          <EndBeat copy={copy} t={t} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      {/* "What guests say" stays put across the five quotes — one entry, no re-entry per cut. */}
      <Sequence name="Heading" from={HOOK} durationInFrames={QUOTES_TOTAL} premountFor={fps}>
        <ZoneBlock anchor="top">
          <Pill start={0}>
            <div style={body(t, C.ink, false)}>{copy.heading}</div>
          </Pill>
        </ZoneBlock>
      </Sequence>
      <SafeZone />
    </AbsoluteFill>
  );
};

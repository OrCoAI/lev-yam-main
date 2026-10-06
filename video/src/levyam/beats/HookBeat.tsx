import { Video } from "@remotion/media";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Accent, Pill, Scrim, TextBlock, Words } from "../parts";
import { C, TYPE, body, clamp, headline, type BeatProps } from "../theme";

// The opening 3s is swappable (`hook` prop) so a tired creative gets a fresh hook without a
// rebuild; everything after the first cut is identical across variants. Each variant's frame 0
// is a scroll-stop frame: footage up, the first word in, the second mid-rise.
//   title — the event's name leads, days underneath.
//   free  — the days lead, "free · no sign-up" pops as a pill, the name follows; the footage
//           starts punched in (≤1.10) and settles out, so the motion differs from frame 0.
export const HookBeat: React.FC<BeatProps> = ({ copy }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = TYPE[copy.lang];
  const free = copy.hook === "free";
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          scale: free
            ? interpolate(frame, [0, 90], [1.1, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) })
            : 1,
        }}
      >
        <Video
          name="Hero boat"
          src={staticFile("site/hero.mp4")}
          muted
          objectFit="cover"
          premountFor={fps}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
      </AbsoluteFill>
      <Scrim side="bottom" reach={52} />
      {free ? (
        <TextBlock anchor="bottom" gap={26}>
          <Words text={copy.days} start={-18} stagger={10} style={headline(t, C.cream)} />
          <Pill start={18}>
            <Words text={copy.cost} start={20} stagger={8} style={body(t, C.ink, false)} />
          </Pill>
          <Words text={copy.title} start={40} stagger={8} style={body(t, C.cream)} />
        </TextBlock>
      ) : (
        <TextBlock anchor="bottom">
          <Words text={copy.title} start={-18} stagger={10} style={headline(t, C.cream)} />
          <Accent start={26} />
          <Words text={copy.days} start={30} stagger={8} style={body(t, C.cream)} />
        </TextBlock>
      )}
    </AbsoluteFill>
  );
};

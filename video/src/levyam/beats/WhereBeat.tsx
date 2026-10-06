import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { KenBurns, Words } from "../parts";
import { C, TYPE, body, clamp, headline, type BeatProps } from "../theme";

// The aerial is 708×387 — too small to fill the frame, so it is a card on blue-deep.
export const WhereBeat: React.FC<BeatProps> = ({ copy, duration }) => {
  const t = TYPE[copy.lang];
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.blueDeep, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "relative",
          width: 900,
          height: 492,
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(10, 25, 33, 0.35)",
          // The card keeps growing through the beat — 900px to 1062px wide, still inside the frame.
          scale: interpolate(frame, [0, duration], [0.86, 1.18], {
            ...clamp,
            easing: Easing.bezier(0.33, 0, 0.67, 1),
          }),
        }}
      >
        <KenBurns src="site/village-aerial.jpg" duration={duration} crop="50% 50%" focus="55% 58%" />
      </div>
      <div style={{ marginTop: 64, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <Words text={copy.location.place} start={10} stagger={10} style={headline(t, C.cream, false)} />
        <Words text={copy.location.area} start={22} stagger={8} style={body(t, C.cream, false)} />
      </div>
    </AbsoluteFill>
  );
};

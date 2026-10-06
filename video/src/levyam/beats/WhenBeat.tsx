import { AbsoluteFill } from "remotion";
import { KenBurns, Scrim, TextBlock, Words } from "../parts";
import { C, TYPE, body, headline, type BeatProps } from "../theme";

// Day label in orange, its hours as the headline; rows enter 28 frames apart, once the sun has opened.
export const WhenBeat: React.FC<BeatProps> = ({ copy, duration }) => {
  const t = TYPE[copy.lang];
  return (
    <AbsoluteFill>
      <KenBurns src="site/sunset-thatch.jpg" duration={duration} crop="64% 50%" focus="30% 36%" />
      <Scrim side="bottom" reach={58} />
      <TextBlock anchor="bottom" gap={30}>
        {copy.hours.map((h, i) => (
          <div key={h.day} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Words text={h.day} start={12 + i * 28} style={body(t, C.orange)} />
            <Words text={h.time} start={18 + i * 28} stagger={10} style={headline(t, C.cream)} />
          </div>
        ))}
      </TextBlock>
    </AbsoluteFill>
  );
};

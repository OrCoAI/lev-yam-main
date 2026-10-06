import { AbsoluteFill } from "remotion";
import { KenBurns, Pill, Scrim, TextBlock, Words } from "../parts";
import { C, TYPE, body, headline, type BeatProps } from "../theme";

export const WhoBeat: React.FC<BeatProps> = ({ copy, duration }) => {
  const t = TYPE[copy.lang];
  return (
    <AbsoluteFill>
      <KenBurns src="site/family-house.jpg" duration={duration} crop="50% 50%" focus="46% 58%" />
      <Scrim side="bottom" reach={44} />
      <TextBlock anchor="bottom" gap={28}>
        <Words text={copy.audience} start={14} stagger={10} style={headline(t, C.cream)} />
        <Pill start={26}>
          <Words text={copy.cost} start={28} stagger={8} style={body(t, C.ink, false)} />
        </Pill>
      </TextBlock>
    </AbsoluteFill>
  );
};

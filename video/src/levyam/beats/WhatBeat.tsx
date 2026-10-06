import { AbsoluteFill } from "remotion";
import { Accent, KenBurns, Scrim, SunDot, TextBlock, Words } from "../parts";
import { C, TYPE, body, headline, type BeatProps, type Type } from "../theme";

const Item: React.FC<{ readonly text: string; readonly start: number; readonly t: Type }> = ({
  text,
  start,
  t,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
    <SunDot start={start} />
    <Words text={text} start={start} stagger={8} style={body(t, C.cream)} />
  </div>
);

// Text sits at the top: the faces are mid-frame and the food fills the bottom.
export const WhatBeat: React.FC<BeatProps> = ({ copy, duration }) => {
  const t = TYPE[copy.lang];
  return (
    <AbsoluteFill>
      <KenBurns src="site/weekend-table.jpg" duration={duration} crop="7% 50%" focus="20% 40%" />
      <Scrim side="top" reach={52} />
      <TextBlock anchor="top" gap={18}>
        <Words text={copy.highlightsHeading} start={6} stagger={8} style={headline(t, C.cream)} />
        <Accent start={24} />
        {copy.highlights.map((item, i) => (
          <Item key={item} text={item} start={28 + i * 14} t={t} />
        ))}
      </TextBlock>
    </AbsoluteFill>
  );
};

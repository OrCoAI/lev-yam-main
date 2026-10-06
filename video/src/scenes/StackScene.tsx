import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Zigzag } from "../brand";
import { BUSINESS } from "../data";
import { PeopleIcon, PinIcon, StarIcon } from "../icons";
import { C, SAFE, SAFE_WIDTH, clamp, fontFamily } from "../theme";

// Each line is a brand "stripe": a coloured tab holding a cream icon (brand book, שפה ואייקונים).
const Line: React.FC<{
  readonly delay: number;
  readonly color: string;
  readonly icon: React.ReactNode;
  readonly children: React.ReactNode;
}> = ({ delay, color, icon, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.8 } });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        width: SAFE_WIDTH,
        height: 170,
        background: C.card,
        border: `3px solid ${C.border}`,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 6px 18px rgba(26,51,64,0.08)",
        opacity: interpolate(s, [0, 0.6], [0, 1], clamp),
        translate: `0 ${interpolate(s, [0, 1], [120, 0])}px`,
      }}
    >
      <div
        style={{
          width: 170,
          flexShrink: 0,
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "0 40px", fontSize: 60, fontWeight: 700, color: C.text }}>
        {children}
      </div>
    </div>
  );
};

export const StackScene: React.FC = () => {
  const frame = useCurrentFrame();
  const customers = interpolate(frame, [10, 55], [0, 100], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const waves = interpolate(frame, [0, 30], [0, 1], clamp);
  return (
    <AbsoluteFill
      dir="rtl"
      style={{
        fontFamily,
        background: C.bg,
        paddingTop: SAFE.top,
        paddingBottom: SAFE.bottom,
        justifyContent: "center",
        alignItems: "center",
        gap: 40,
      }}
    >
      <Zigzag width={SAFE_WIDTH} color={C.orange} progress={waves} style={{ marginBottom: 30 }} />
      <Line delay={0} color={C.orange} icon={<StarIcon size={84} color={C.bg} />}>
        דירוג {BUSINESS.rating.toFixed(1)} כוכבים
      </Line>
      <Line delay={10} color={C.blue} icon={<PeopleIcon size={84} color={C.bg} />}>
        יותר מ-{Math.round(customers)} לקוחות מרוצים
      </Line>
      <Line delay={20} color={C.orange} icon={<PinIcon size={84} color={C.bg} />}>
        {BUSINESS.location}
      </Line>
      <Zigzag width={SAFE_WIDTH} color={C.blue} progress={waves} speed={-1.2} style={{ marginTop: 30 }} />
    </AbsoluteFill>
  );
};

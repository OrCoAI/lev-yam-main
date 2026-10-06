import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Zigzag } from "../brand";
import { BUSINESS } from "../data";
import { Star } from "../icons";
import { C, clamp, fontFamily } from "../theme";

const STAR_SIZE = 150;
const STAR_GAP = 22;
const ROW_TOP = 700;

const Shimmer: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {new Array(28).fill(0).map((_, i) => {
        const x = 90 + random(`x${i}`) * 900;
        const y = ROW_TOP - 120 + random(`y${i}`) * (STAR_SIZE + 240);
        const size = 6 + random(`s${i}`) * 12;
        const phase = random(`p${i}`) * Math.PI * 2;
        const twinkle = 0.5 + 0.5 * Math.sin(frame * 0.18 + phase);
        const color = i % 4 === 0 ? C.blue : C.orange;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y - frame * (0.3 + random(`v${i}`) * 0.5),
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 ${size * 2}px ${color}`,
              opacity: twinkle * 0.45 * interpolate(frame, [0, 20], [0, 1], clamp),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const RatingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const number = interpolate(frame, [8, 52], [0, BUSINESS.rating], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const label = spring({ frame: frame - 40, fps, config: { damping: 200 } });
  const count = interpolate(frame, [40, 75], [0, BUSINESS.reviewCount], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const sun = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill dir="rtl" style={{ fontFamily, background: C.bg }}>
      {/* Hand-cut sun disc slowly turning behind the stars */}
      <Img
        src={staticFile("site/icons/sun-orange.png")}
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          left: 90,
          top: ROW_TOP - 200,
          opacity: 0.14 * sun,
          scale: interpolate(sun, [0, 1], [0.7, 1]),
          rotate: `${frame * 0.25}deg`,
        }}
      />
      <Shimmer />
      <div
        style={{
          position: "absolute",
          top: ROW_TOP,
          width: "100%",
          display: "flex",
          direction: "ltr",
          justifyContent: "center",
          gap: STAR_GAP,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const s = spring({ frame: frame - 4 - i * 8, fps, config: { damping: 12, mass: 0.7 } });
          return (
            <Star
              key={i}
              size={STAR_SIZE}
              fill={s * Math.min(1, Math.max(0, BUSINESS.rating - i))}
              style={{ scale: interpolate(s, [0, 1], [0.7, 1], clamp), rotate: `${interpolate(s, [0, 1], [-25, 0])}deg` }}
            />
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: ROW_TOP + STAR_SIZE + 50,
          width: "100%",
          textAlign: "center",
          fontSize: 220,
          fontWeight: 800,
          color: C.text,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {number.toFixed(1)}
      </div>
      <div
        style={{
          position: "absolute",
          top: ROW_TOP + STAR_SIZE + 310,
          width: "100%",
          textAlign: "center",
          fontSize: 52,
          fontWeight: 600,
          color: C.muted,
          opacity: label,
          translate: `0 ${interpolate(label, [0, 1], [24, 0])}px`,
        }}
      >
        מבוסס על {Math.round(count)} ביקורות בגוגל
      </div>
      <Zigzag
        width={360}
        color={C.blue}
        progress={label}
        style={{ position: "absolute", top: ROW_TOP + STAR_SIZE + 420, left: 360 }}
      />
    </AbsoluteFill>
  );
};

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PalmSun, Wordmark, Zigzag } from "../brand";
import { BUSINESS } from "../data";
import { Star, StarRow } from "../icons";
import { C, SAFE, SAFE_WIDTH, clamp, fontFamily } from "../theme";

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = spring({ frame: frame - 8, fps, config: { damping: 14, mass: 0.8 } });
  const rating = spring({ frame: frame - 18, fps, config: { damping: 200 } });
  const waves = interpolate(frame, [6, 36], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });

  return (
    <AbsoluteFill
      dir="rtl"
      style={{
        fontFamily,
        background: `linear-gradient(180deg, #ffe9cc 0%, ${C.bg} 45%, ${C.bg} 100%)`,
      }}
    >
      {/* Decorative star cluster, upper area, 15% */}
      <AbsoluteFill style={{ opacity: 0.15 }}>
        <Star size={300} style={{ position: "absolute", top: 170, right: 40, rotate: `${interpolate(frame, [0, 100], [12, 22])}deg` }} />
        <Star size={210} style={{ position: "absolute", top: 260, left: 50, rotate: `${interpolate(frame, [0, 100], [-18, -28])}deg` }} />
        <Star size={140} style={{ position: "absolute", top: 660, left: 150, rotate: `${interpolate(frame, [0, 100], [24, 38])}deg` }} />
      </AbsoluteFill>

      <div style={{ position: "absolute", top: SAFE.top + 70, left: 540 - 240 }}>
        <PalmSun size={480} />
      </div>
      <Zigzag
        width={420}
        color={C.orange}
        progress={waves}
        style={{ position: "absolute", top: SAFE.top + 70 + 470, left: 540 - 210 }}
      />

      <AbsoluteFill
        style={{
          top: 820,
          left: SAFE.side,
          width: SAFE_WIDTH,
          height: "auto",
          bottom: SAFE.bottom,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: text,
            translate: `0 ${interpolate(text, [0, 1], [40, 0])}px`,
          }}
        >
          <div style={{ fontSize: 60, fontWeight: 700, color: C.text }}>מה אומרים על</div>
          <Wordmark size={150} />
        </div>
        <div
          style={{
            marginTop: 28,
            display: "flex",
            direction: "ltr",
            alignItems: "center",
            gap: 20,
            opacity: rating,
            translate: `0 ${interpolate(rating, [0, 1], [16, 0], clamp)}px`,
          }}
        >
          <StarRow size={56} rating={BUSINESS.rating} />
          <span style={{ fontSize: 60, fontWeight: 800, color: C.text }}>{BUSINESS.rating.toFixed(1)}</span>
        </div>
      </AbsoluteFill>

      <div style={{ position: "absolute", bottom: SAFE.bottom + 40, left: 0, width: 1080, display: "flex", flexDirection: "column", gap: 14 }}>
        <Zigzag width={1080} color={C.blue} progress={waves} speed={1.5} />
        <Zigzag width={1080} color={C.orange} progress={waves} speed={-1.1} />
      </div>
    </AbsoluteFill>
  );
};

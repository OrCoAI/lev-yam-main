import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { StampFrame, Wordmark, Zigzag } from "../brand";
import { BUSINESS } from "../data";
import { StarRow } from "../icons";
import { C, SAFE, SAFE_WIDTH, clamp, fontFamily } from "../theme";

const PHOTO_W = SAFE_WIDTH - 40;
const PHOTO_H = 500;
const INSET = 22;

export const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const photo = spring({ frame, fps, config: { damping: 200 } });
  const draw = interpolate(frame, [0, 24], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const name = spring({ frame: frame - 4, fps, config: { damping: 12, mass: 0.7 } });
  const button = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 0.8 } });
  const url = spring({ frame: frame - 16, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      dir="rtl"
      style={{
        fontFamily,
        background: C.bg,
        paddingTop: SAFE.top + 30,
        paddingBottom: SAFE.bottom + 20,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Photo mounted like a postage stamp — the brand's photo treatment */}
      <div
        style={{
          position: "relative",
          width: PHOTO_W,
          height: PHOTO_H,
          opacity: photo,
          scale: interpolate(photo, [0, 1], [0.94, 1]),
          rotate: `${interpolate(photo, [0, 1], [-4, -1.5])}deg`,
        }}
      >
        <StampFrame width={PHOTO_W} height={PHOTO_H} color={C.orange} fill={C.card} progress={draw} tooth={26} amp={13} />
        <Img
          src={staticFile("photos/terrace.jpg")}
          style={{
            position: "absolute",
            left: INSET,
            top: INSET,
            width: PHOTO_W - INSET * 2,
            height: PHOTO_H - INSET * 2,
            objectFit: "cover",
          }}
        />
      </div>
      <Wordmark
        size={140}
        style={{
          marginTop: 40,
          scale: interpolate(name, [0, 1], [0.6, 1], clamp),
          opacity: interpolate(name, [0, 0.5], [0, 1], clamp),
        }}
      />
      <div style={{ fontSize: 44, fontWeight: 700, color: C.blue, opacity: name }}>כפר הדייגים בג'סר א-זרקא</div>
      <div style={{ marginTop: 14, opacity: name }}>
        <StarRow size={44} rating={BUSINESS.rating} />
      </div>
      <div
        style={{
          marginTop: 44,
          width: SAFE_WIDTH,
          height: 120,
          borderRadius: 16,
          background: C.orange,
          color: C.text,
          fontSize: 54,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 8px 0 ${C.orangeDeep}`,
          opacity: interpolate(button, [0, 0.5], [0, 1], clamp),
          translate: `0 ${interpolate(button, [0, 1], [100, 0])}px`,
        }}
      >
        הזמינו עכשיו
      </div>
      <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 24, opacity: url }}>
        <Zigzag width={90} color={C.blue} amp={14} period={36} stroke={5} />
        <span style={{ fontSize: 44, fontWeight: 600, color: C.muted }}>{BUSINESS.website}</span>
        <Zigzag width={90} color={C.blue} amp={14} period={36} stroke={5} speed={-1.2} />
      </div>
    </AbsoluteFill>
  );
};

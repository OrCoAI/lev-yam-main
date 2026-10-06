import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { StampFrame, Zigzag } from "../brand";
import { BUSINESS } from "../data";
import { GoogleG, QuoteIcon, StarRow } from "../icons";
import { C, SAFE, SAFE_WIDTH, bodyFamily, clamp, fontFamily } from "../theme";

type Graphic = "bars" | "heart" | "house";

const CARD_TOP = 420;
const CARD_HEIGHT = 460;
const GRAPHIC_TOP = 1010;
const GRAPHIC_HEIGHT = 520;

const RatingBars: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...BUSINESS.distribution);
  return (
    <div style={{ width: 820, display: "flex", flexDirection: "column", gap: 30 }}>
      {BUSINESS.distribution.map((n, i) => {
        const s = spring({ frame: frame - 12 - i * 5, fps, config: { damping: 18 } });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, direction: "ltr" }}>
            <span style={{ width: 40, fontSize: 40, fontWeight: 700, color: C.muted }}>{5 - i}</span>
            <div style={{ flex: 1, height: 30, borderRadius: 15, background: C.track, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${(n / max) * 100 * s}%`,
                  minWidth: n > 0 ? 30 * s : 0,
                  borderRadius: 15,
                  background: C.orange,
                }}
              />
            </div>
            <span style={{ width: 80, fontSize: 36, fontWeight: 600, color: C.muted, textAlign: "right" }}>
              {n}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const HeartCount: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 10, fps, config: { damping: 9, mass: 0.8 } });
  const count = interpolate(frame, [14, 60], [0, BUSINESS.reviewCount], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <Img src={staticFile("site/icons/heart.png")} style={{ width: 242, height: 220, scale: pop, rotate: `${interpolate(pop, [0, 1], [-12, 0])}deg` }} />
      <div style={{ fontSize: 96, fontWeight: 800, color: C.blue, lineHeight: 1 }}>{Math.round(count)}</div>
      <div style={{ fontSize: 44, fontWeight: 600, color: C.icon }}>ביקורות בגוגל</div>
    </div>
  );
};

const HouseByTheSea: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame: frame - 10, fps, config: { damping: 11 } });
  const ring = (offset: number) => {
    const t = ((frame + offset) % 40) / 40;
    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 60,
          width: 300,
          height: 300,
          marginLeft: -150,
          borderRadius: "50%",
          border: `5px solid ${C.orange}`,
          scale: 0.6 + t * 0.8,
          opacity: (1 - t) * 0.7,
        }}
      />
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative", width: 420, height: 300 }}>
        {ring(0)}
        {ring(20)}
        <Img
          src={staticFile("site/icons/house-blue.png")}
          style={{
            position: "absolute",
            left: 210 - 140,
            top: 70,
            width: 280,
            height: 185,
            translate: `0 ${interpolate(drop, [0, 1], [-80, 0])}px`,
            opacity: drop,
          }}
        />
      </div>
      <Zigzag width={460} color={C.blue} progress={drop} speed={1.4} />
      <Zigzag width={460} color={C.orange} progress={drop} speed={-1} />
      <div style={{ marginTop: 10, fontSize: 52, fontWeight: 700, color: C.muted }}>{BUSINESS.beach}</div>
    </div>
  );
};

type Props = {
  readonly name: string;
  readonly text: string;
  readonly graphic: Graphic;
  readonly frameColor: string;
};

export const ReviewSlide: React.FC<Props> = ({ name, text, graphic, frameColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const draw = interpolate(frame, [0, 28], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill dir="rtl" style={{ fontFamily }}>
      <div
        style={{
          position: "absolute",
          top: SAFE.top,
          left: SAFE.side,
          opacity: 0.12 * enter,
        }}
      >
        <QuoteIcon size={200} color={C.blue} />
      </div>

      <div
        style={{
          position: "absolute",
          top: CARD_TOP,
          left: SAFE.side,
          width: SAFE_WIDTH,
          height: CARD_HEIGHT,
          translate: `0 ${interpolate(enter, [0, 1], [30, 0])}px`,
        }}
      >
        <StampFrame width={SAFE_WIDTH} height={CARD_HEIGHT} color={frameColor} progress={draw} />
        <div
          style={{
            position: "relative",
            height: "100%",
            boxSizing: "border-box",
            padding: "0 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            opacity: enter,
          }}
        >
        <StarRow size={40} gap={6} />
        <div
          style={{
            marginTop: 30,
            fontFamily: bodyFamily,
            fontSize: 46,
            fontWeight: 600,
            lineHeight: 1.4,
            color: C.text,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          "{text}"
        </div>
        <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 14, fontSize: 32, color: C.muted }}>
          <span style={{ fontWeight: 700, color: C.text }}>{name}</span>
          <span>·</span>
          <GoogleG size={34} />
          <span>ביקורת Google</span>
        </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: GRAPHIC_TOP,
          left: SAFE.side,
          width: SAFE_WIDTH,
          height: GRAPHIC_HEIGHT,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: 0.5 * enter,
        }}
      >
        {graphic === "bars" ? <RatingBars /> : graphic === "heart" ? <HeartCount /> : <HouseByTheSea />}
      </div>
    </AbsoluteFill>
  );
};

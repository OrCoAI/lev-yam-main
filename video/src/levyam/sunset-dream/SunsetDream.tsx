import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LOOP, STAGE, STOPS, SUN } from "./geometry";
import {
  Bokeh,
  DriftingClouds,
  GodRays,
  Gull,
  LightLeak,
  PHOTO,
  SkyWash,
  SunBloom,
  WaterGlitter,
} from "./layers";

// gallery/16 brought to life: a slow push-in on the stage, clouds drifting, the sun breathing,
// glints on the water, gulls crossing, and the grade cycling golden → hibiscus → lagoon →
// orchid. A warm flash closes and opens the 12s loop, so the Reel repeats without a seam.
export const SunsetDream: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a0f1f", overflow: "hidden" }}>
      <Interactive.Div
        name="Stage"
        style={{
          position: "absolute",
          left: STAGE.left,
          top: 0,
          width: STAGE.width,
          height: STAGE.height,
          transformOrigin: `${SUN.x - 120}px ${SUN.y + 260}px`,
          scale: interpolate(frame, [0, LOOP], [1, 1.13], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.37, 0, 0.63, 1),
            output: "perceptual-scale",
          }),
          translate: interpolate(frame, [0, LOOP], ["0px 0px", "-36px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.37, 0, 0.63, 1),
          }),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: `saturate(1.28) contrast(1.06) hue-rotate(${interpolate(frame, STOPS, [0, -8, 9, -6, 0])}deg)`,
          }}
        >
          <CanvasImage
            name="Photo"
            src={PHOTO}
            width={STAGE.width}
            height={STAGE.height}
            fit="fill"
            premountFor={fps}
            style={{ position: "absolute", left: 0, top: 0, width: STAGE.width, height: STAGE.height }}
          />
          <DriftingClouds />
        </div>
        <SkyWash />
        <GodRays />
        <Gull name="Gull — high" from={8} durationInFrames={300} premountFor={fps} y={250} size={64} flapsPerSecond={2.2} />
        <Gull name="Gull — low" from={70} durationInFrames={270} premountFor={fps} y={360} size={46} flapsPerSecond={2.8} />
        <Gull name="Gull — near" from={170} durationInFrames={190} premountFor={fps} y={170} size={92} flapsPerSecond={1.8} />
        <SunBloom />
        <WaterGlitter />
      </Interactive.Div>
      <Bokeh />
      <LightLeak name="Leak — hibiscus" from={30} durationInFrames={110} premountFor={fps} seed={3} hueShift={60} />
      <LightLeak name="Leak — lagoon" from={150} durationInFrames={110} premountFor={fps} seed={7} hueShift={200} />
      <LightLeak name="Leak — orchid" from={250} durationInFrames={110} premountFor={fps} seed={11} hueShift={120} />
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 75% 60% at 50% 46%, transparent 55%, rgba(34, 10, 52, 0.62) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${SUN.x + STAGE.left}px ${SUN.y}px, #fff8e8 0%, #ffd9a0 35%, #ff9f7a 80%)`,
          opacity: interpolate(frame, [0, 16, LOOP - 22, LOOP - 1], [0.92, 0, 0, 0.92], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.33, 0, 0.67, 1),
          }),
        }}
      />
    </AbsoluteFill>
  );
};

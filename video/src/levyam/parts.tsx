import { Fragment } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, ENTER, TEXT, clamp } from "./theme";

// Entry progress for something that starts at local frame `start`; lands on exactly 1 at
// start + ENTER — spring() itself keeps creeping toward 1, which would stir the held last frames.
export const useEnter = (start: number) => {
  const frame = useCurrentFrame() - start;
  const { fps } = useVideoConfig();
  return frame >= ENTER ? 1 : spring({ frame, fps, config: { damping: 200 }, durationInFrames: ENTER });
};

// Digit runs (times, ranges) render LTR in an isolate, so the RTL line never reorders them.
const DIGITS = /(\d[\d:.,–-]*\d|\d)/;

export const Bidi: React.FC<{ readonly text: string }> = ({ text }) => (
  <>
    {text.split(DIGITS).map((part, i) =>
      i % 2 === 1 ? (
        <bdi key={i} dir="ltr">
          {part}
        </bdi>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    )}
  </>
);

export const Rise: React.FC<{ readonly start: number; readonly children: React.ReactNode }> = ({
  start,
  children,
}) => {
  const p = useEnter(start);
  return (
    <span
      style={{
        display: "inline-block",
        opacity: p,
        translate: `0 ${interpolate(p, [0, 1], [0.35, 0], clamp)}em`,
      }}
    >
      {children}
    </span>
  );
};

type WordsProps = {
  readonly text: string;
  readonly start: number;
  readonly stagger?: number;
  readonly style?: React.CSSProperties;
};

// Per-word reveal. Splits on spaces only, so a Hebrew or Arabic word is never broken apart;
// the flex row inherits dir="rtl", so words lay out right to left.
export const Words: React.FC<WordsProps> = ({ text, start, stagger = 10, style }) => (
  <div style={{ display: "flex", flexWrap: "wrap", columnGap: "0.26em", ...style }}>
    {text.split(" ").map((word, i) => (
      <Rise key={i} start={start + i * stagger}>
        <Bidi text={word} />
      </Rise>
    ))}
  </div>
);

type KenBurnsProps = {
  readonly src: string;
  readonly duration: number;
  // object-position of the cover crop, and the transform-origin the zoom closes in on.
  readonly crop: string;
  readonly focus: string;
};

// Slow push-in toward the subject; capped at 1.08 (brief: ≤1.10).
export const KenBurns: React.FC<KenBurnsProps> = ({ src, duration, crop, focus }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: crop,
          transformOrigin: focus,
          scale: interpolate(frame, [0, duration], [1, 1.08], {
            ...clamp,
            easing: Easing.bezier(0.33, 0, 0.67, 1),
          }),
        }}
      />
    </AbsoluteFill>
  );
};

// Ink gradient behind text on photos; `reach` is how far up (or down) it fades out, in %.
export const Scrim: React.FC<{ readonly side: "top" | "bottom"; readonly reach: number }> = ({
  side,
  reach,
}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(to ${side === "bottom" ? "top" : "bottom"}, rgba(26, 51, 64, 0.9) 0%, rgba(26, 51, 64, 0.72) ${reach * 0.45}%, rgba(26, 51, 64, 0) ${reach}%)`,
    }}
  />
);

// The site's wave divider (css/styles.css .wave-divider: the 80×16 tile "M0 8 L20 2 L60 14 L80 8"),
// two tiles long, drawn in from the inline start (the right edge in both RTL cuts).
export const Accent: React.FC<{ readonly start: number }> = ({ start }) => {
  const p = useEnter(start);
  return (
    <svg
      width={240}
      height={30}
      viewBox="0 -2 160 20"
      style={{ overflow: "visible", clipPath: `inset(-10% 0 -10% ${(1 - p) * 100}%)` }}
    >
      <path
        d="M0 8 L20 2 L60 14 L80 8 L100 2 L140 14 L160 8"
        fill="none"
        stroke={C.orange}
        strokeWidth={3.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// The site's sun icon as a bullet; pops in at `start`.
export const SunDot: React.FC<{ readonly start: number }> = ({ start }) => {
  const p = useEnter(start);
  return (
    <Img
      src={staticFile("site/icons/sun-orange.png")}
      style={{ width: 30, height: 30, flexShrink: 0, scale: interpolate(p, [0, 1], [0, 1], clamp) }}
    />
  );
};

type TextBlockProps = {
  readonly anchor: "top" | "bottom";
  readonly gap?: number;
  readonly children: React.ReactNode;
};

// Text column inside the safe zone, start-aligned (right in RTL), pinned to the top or bottom.
export const TextBlock: React.FC<TextBlockProps> = ({ anchor, gap = 22, children }) => (
  <AbsoluteFill
    style={{
      justifyContent: anchor === "bottom" ? "flex-end" : "flex-start",
      alignItems: "flex-start",
      paddingTop: TEXT.top,
      paddingBottom: TEXT.bottom,
      paddingInlineStart: TEXT.start,
      paddingInlineEnd: TEXT.end,
      gap,
    }}
  >
    {children}
  </AbsoluteFill>
);

// Orange chip with ink text (contrast 5.9:1); pops in at `start`.
export const Pill: React.FC<{ readonly start: number; readonly children: React.ReactNode }> = ({
  start,
  children,
}) => {
  const p = useEnter(start);
  return (
    <div
      style={{
        backgroundColor: C.orange,
        borderRadius: 999,
        padding: "12px 36px",
        opacity: p,
        scale: interpolate(p, [0, 1], [0.92, 1], clamp),
      }}
    >
      {children}
    </div>
  );
};

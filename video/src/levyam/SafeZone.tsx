import { AbsoluteFill, getRemotionEnvironment, useVideoConfig } from "remotion";
import { C, META, ZONE } from "./theme";

// Studio-only guide for Meta's Reels / Stories safe zone (guidelines §3): the bands the platform
// UI covers and, dashed, the text zone key copy stays inside — drawn from META / ZONE in theme.ts,
// so the guide, the tokens and the reviewer cannot disagree. Never in a real render: it draws in
// the Studio preview and in the review script's `--guide` stills (SHOW_SAFE_ZONE=1 passed as an
// env variable at render time), nowhere else.
export const SafeZone: React.FC = () => {
  const { isStudio } = getRemotionEnvironment();
  const { width, height } = useVideoConfig();
  if (!isStudio && process.env.SHOW_SAFE_ZONE !== "1") return null;
  const band = `${C.orange}2e`;
  const line = `${C.orange}e6`;
  const label: React.CSSProperties = {
    position: "absolute",
    fontFamily: "Helvetica, Arial, sans-serif",
    fontSize: 22,
    color: line,
    letterSpacing: 1,
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width, height: height * META.top, background: band }} />
      <div style={{ position: "absolute", left: 0, bottom: 0, width, height: height * META.bottom, background: band }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: width * META.side, height, background: band }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: width * META.side, height, background: band }} />
      <div
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: width * META.rail.width,
          height: height * META.rail.height,
          background: band,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: width * ZONE.x0,
          top: height * ZONE.y0,
          width: width * (ZONE.x1 - ZONE.x0),
          height: height * (ZONE.y1 - ZONE.y0),
          border: `2px dashed ${line}`,
        }}
      />
      <div style={{ ...label, left: width * ZONE.x0 + 12, top: height * ZONE.y0 + 8 }}>TEXT ZONE · Meta Reels / Stories</div>
      <div style={{ ...label, left: 12, top: height * META.top - 32 }}>{Math.round(META.top * 100)}% TOP</div>
      <div style={{ ...label, left: 12, bottom: height * META.bottom + 8 }}>{Math.round(META.bottom * 100)}% BOTTOM</div>
    </AbsoluteFill>
  );
};

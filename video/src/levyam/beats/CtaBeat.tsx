import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { Pill, Rise, Words, useEnter } from "../parts";
import { C, TYPE, body, clamp, headline, type BeatProps } from "../theme";

// Everything settles by local frame 50; the reel's last 1.5s (global 555–599 = local 50–94)
// is a still frame. Cream background because the logo is blue + orange — and it is the cream
// of the heart the previous cut dives into.
export const CtaBeat: React.FC<BeatProps> = ({ copy }) => {
  const t = TYPE[copy.lang];
  const logo = useEnter(4);
  return (
    <AbsoluteFill style={{ backgroundColor: C.cream, justifyContent: "center", alignItems: "center" }}>
      <Img
        src={staticFile("site/logo.png")}
        style={{
          width: 420,
          height: 420,
          opacity: logo,
          scale: interpolate(logo, [0, 1], [0.92, 1], clamp),
        }}
      />
      <Words
        text={copy.cta.headline}
        start={8}
        stagger={10}
        style={{ ...headline(t, C.ink, false), marginTop: 36 }}
      />
      <Words text={copy.cta.line} start={18} stagger={8} style={{ ...body(t, C.inkSoft, false), marginTop: 12 }} />
      <div style={{ marginTop: 40 }}>
        <Pill start={28}>
          <Rise start={28}>
            <bdi dir="ltr" style={{ fontFamily: t.body, fontSize: t.small, fontWeight: 600, color: C.ink }}>
              {copy.cta.url}
            </bdi>
          </Rise>
        </Pill>
      </div>
    </AbsoluteFill>
  );
};

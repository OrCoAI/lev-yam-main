import { Pill, Rise, SignOff, Words } from "../parts";
import { C, TYPE, body, type BeatProps } from "../theme";

// Everything settles by local frame 50; the reel's last 1.5s (global 555–599 = local 50–94)
// is a still frame. The logo, cream and title come from the kit's SignOff.
export const CtaBeat: React.FC<BeatProps> = ({ copy }) => {
  const t = TYPE[copy.lang];
  return (
    <SignOff t={t} title={copy.cta.headline}>
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
    </SignOff>
  );
};

import { Composition, Folder } from "remotion";
import { ar } from "./copy/ar";
import { he } from "./copy/he";
import { PLACEHOLDER_REVIEWS, loadReviews } from "./data";
import { WeekendReel } from "./levyam/WeekendReel";
import { weekendReelSchema } from "./levyam/schema";
import { Gull, LightLeak } from "./levyam/sunset-dream/layers";
import { SunsetDream } from "./levyam/sunset-dream/SunsetDream";
import { CarouselScene } from "./scenes/CarouselScene";
import { CtaScene } from "./scenes/CtaScene";
import { HookScene } from "./scenes/HookScene";
import { RatingScene } from "./scenes/RatingScene";
import { StackScene } from "./scenes/StackScene";
import { Testimonial } from "./Testimonial";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LevYamTestimonial"
        component={Testimonial}
        durationInFrames={600}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ reviews: PLACEHOLDER_REVIEWS }}
        calculateMetadata={loadReviews}
      />
      <Folder name="Scenes">
        <Composition id="Hook" component={HookScene} durationInFrames={90} fps={30} width={1080} height={1920} />
        <Composition id="Rating" component={RatingScene} durationInFrames={90} fps={30} width={1080} height={1920} />
        <Composition
          id="Reviews"
          component={CarouselScene}
          durationInFrames={280}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ reviews: PLACEHOLDER_REVIEWS }}
          calculateMetadata={loadReviews}
        />
        <Composition id="SocialProof" component={StackScene} durationInFrames={85} fps={30} width={1080} height={1920} />
        <Composition id="CTA" component={CtaScene} durationInFrames={55} fps={30} width={1080} height={1920} />
      </Folder>
      <Folder name="LevYam-Reels">
        <Composition
          id="WeekendReel-he"
          component={WeekendReel}
          schema={weekendReelSchema}
          durationInFrames={600}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={he}
        />
        <Composition
          id="WeekendReel-ar"
          component={WeekendReel}
          schema={weekendReelSchema}
          durationInFrames={600}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={ar}
        />
        <Composition
          id="WeekendReel-he-hookB"
          component={WeekendReel}
          schema={weekendReelSchema}
          durationInFrames={600}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ ...he, hook: "free" as const }}
        />
        <Composition
          id="WeekendReel-ar-hookB"
          component={WeekendReel}
          schema={weekendReelSchema}
          durationInFrames={600}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ ...ar, hook: "free" as const }}
        />
        <Composition
          id="SunsetDream"
          component={SunsetDream}
          durationInFrames={360}
          fps={30}
          width={1080}
          height={1920}
        />
        <Folder name="SunsetDream-parts">
          <Composition
            id="SunsetDream-Gull"
            component={Gull}
            durationInFrames={240}
            fps={30}
            width={1080}
            height={1080}
            defaultProps={{ y: 500, size: 90, flapsPerSecond: 2.4 }}
          />
          <Composition
            id="SunsetDream-LightLeak"
            component={LightLeak}
            durationInFrames={120}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={{ seed: 3, hueShift: 300 }}
          />
        </Folder>
      </Folder>
    </>
  );
};

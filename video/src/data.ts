import type { CalculateMetadataFunction } from "remotion";
import { getRemotionEnvironment, staticFile } from "remotion";

// The venue's public Google Business Profile figures (read 2026-10-05). Refresh before a render.
export const BUSINESS = {
  name: "לב ים",
  rating: 5.0,
  reviewCount: 105,
  // Review counts for 5★ … 1★.
  distribution: [104, 0, 0, 1, 0],
  location: "ג'סר א-זרקא, ישראל",
  beach: "חוף ג'סר א-זרקא",
  website: "levyam.com",
};

export type Review = { name: string; text: string };
export type ReviewProps = { reviews: Review[] };

// Review texts and reviewer labels are NOT in this public repo (owner, 2026-10-06; guidelines
// §1.1). They live in the gitignored `video/public/private/reviews.json`:
//   { "reviews": [{ "name": "אורחת", "text": "…" }, …] }  (exactly REVIEW_SLOTS entries)
// `loadReviews` (a composition's `calculateMetadata`) reads it in Studio and at render time.
// Without the file, Studio shows the [חסר] placeholders — a missing fact, never a guess — and a
// render (stills or MP4) fails, so a placeholder reel can never be rendered by accident. When
// the file exists it wins over `--props` / Studio-edited `reviews`.
export const REVIEW_SLOTS = 3;
export const REVIEWS_FILE = "private/reviews.json";

export const PLACEHOLDER_REVIEWS: Review[] = Array.from({ length: REVIEW_SLOTS }, (_, i) => ({
  name: "אורח/ת",
  text: `[חסר: ביקורת ${i + 1} — video/public/${REVIEWS_FILE}]`,
}));

const isReview = (r: unknown): r is Review =>
  typeof r === "object" && r !== null && typeof (r as Review).name === "string" && typeof (r as Review).text === "string";

export const loadReviews: CalculateMetadataFunction<ReviewProps> = async ({ props }) => {
  const res = await fetch(staticFile(REVIEWS_FILE));
  if (!res.ok) {
    if (getRemotionEnvironment().isRendering) {
      throw new Error(`video/public/${REVIEWS_FILE} is missing (${res.status}) — a render needs the owner's copy`);
    }
    return { props }; // Studio without the file → placeholders
  }
  const { reviews } = (await res.json()) as { reviews?: unknown }; // a malformed file throws, rightly
  if (!Array.isArray(reviews) || reviews.length !== REVIEW_SLOTS || !reviews.every(isReview)) {
    throw new Error(`${REVIEWS_FILE} must hold exactly ${REVIEW_SLOTS} {name, text} reviews`);
  }
  return { props: { ...props, reviews } };
};

// Per-medium metadata for the reviews collection (content.config.ts). Keyed
// by the `medium` enum there, so adding a medium means adding it in both
// places — TypeScript flags this file if the enum grows and this doesn't.
import type { ReviewsCollectionItem } from "@nuxt/content";

export type ReviewMedium = ReviewsCollectionItem["medium"];

export interface MediumInfo {
  /** Singular label shown on cards and the review page. */
  label: string;
  /** Plural label for the /reviews filter chips. */
  plural: string;
  /** schema.org type for the review's itemReviewed. Board games use the
   *  generic `Game` because schema.org has no BoardGame type. */
  schemaType: string;
}

export const media: Record<ReviewMedium, MediumInfo> = {
  film: { label: "Film", plural: "Films", schemaType: "Movie" },
  series: { label: "Series", plural: "Series", schemaType: "TVSeries" },
  "video-game": {
    label: "Video game",
    plural: "Video games",
    schemaType: "VideoGame",
  },
  "board-game": {
    label: "Board game",
    plural: "Board games",
    schemaType: "Game",
  },
  book: { label: "Book", plural: "Books", schemaType: "Book" },
  other: { label: "Other", plural: "Other", schemaType: "CreativeWork" },
};

/** Highest possible rating; also the width of its binary encoding. */
export const MAX_RATING = 10;

/** A 0–10 rating as 4 binary digits, most significant first: 8 -> "1000".
 *  Four bits because 10 (1010) is the largest value; padding every rating
 *  to the same width keeps cards aligned. */
export function ratingToBits(rating: number): string {
  // Throwing here fails `npm run generate`, which is the only place a
  // non-whole rating can be caught: the content schema can't express it
  // (see the comment on `rating` in content.config.ts).
  if (!Number.isInteger(rating) || rating < 0 || rating > MAX_RATING) {
    throw new Error(
      `Review rating must be a whole number from 0 to ${MAX_RATING}, got ${rating}`,
    );
  }
  return rating.toString(2).padStart(MAX_RATING.toString(2).length, "0");
}

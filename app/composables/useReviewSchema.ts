// Review + BreadcrumbList JSON-LD for an individual review page, the
// counterpart of useArticleSchema. Review (not BlogPosting) with a typed
// itemReviewed and a reviewRating is what makes a page eligible for review
// rich results; the itemReviewed type comes from app/utils/reviews.ts.
import { MAX_RATING, media, type ReviewMedium } from "~/utils/reviews";

export interface ReviewSchemaInput {
  title: string;
  description: string;
  slug: string;
  date: string; // ISO-ish date string as stored in frontmatter
  image: string;
  medium: ReviewMedium;
  subject: { name: string; year?: number };
  rating: number;
}

export function useReviewSchema(review: ReviewSchemaInput) {
  const url = `https://brandonverzuu.com/reviews/${review.slug}`;
  const author = {
    "@type": "Person",
    name: "Brandon Verzuu",
    url: "https://brandonverzuu.com",
  };

  useHead({
    script: [
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Review",
          name: review.title,
          description: review.description,
          image: `https://brandonverzuu.com${review.image}`,
          datePublished: review.date,
          url,
          author,
          publisher: author,
          itemReviewed: {
            "@type": media[review.medium].schemaType,
            name: review.subject.name,
            // dateCreated rather than per-type fields (datePublished,
            // releasedEvent…) since it is valid on every CreativeWork.
            ...(review.subject.year && {
              dateCreated: String(review.subject.year),
            }),
          },
          reviewRating: {
            "@type": "Rating",
            ratingValue: review.rating,
            bestRating: MAX_RATING,
            worstRating: 0,
          },
        }),
      },
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://brandonverzuu.com/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Reviews",
              item: "https://brandonverzuu.com/reviews",
            },
            {
              "@type": "ListItem",
              position: 3,
              name: review.title,
              item: url,
            },
          ],
        }),
      },
    ],
  });
}

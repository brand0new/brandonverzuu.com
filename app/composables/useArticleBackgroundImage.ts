// Shared reactive state carrying the current article's cover image path, so
// app.vue (which owns the full-width background layer, positioned outside
// the width-constrained <UContainer> the page content sits in) can render
// AppArticleDitherBackground without the article page needing to reach into
// app.vue directly. Set from pages/articles/[slug].vue on mount and cleared
// on unmount so navigating away (e.g. to /articles or /) doesn't leak the
// previous article's image onto a page that shouldn't have one.
//
// useState (not a plain module-level ref) so it's per-request on the server
// and doesn't leak between concurrent SSR renders.
export function useArticleBackgroundImage() {
  return useState<string | null>("article-background-image", () => null);
}

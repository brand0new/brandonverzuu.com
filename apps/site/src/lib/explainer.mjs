// The explainer video's markup, shared by the story template (above the body) and the
// ::explainer story block (anywhere in the body), so both render the same element. The
// player script lives in src/pages/articles/[slug].astro.
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function explainerHtml({ explainerVideo, explainerVideoWebm, explainerPoster, explainerAlt }) {
  return `<figure class="explainer" id="explainer">
  <div class="ex-frame">
    <video${explainerPoster ? ` poster="${esc(explainerPoster)}"` : ""} aria-label="${esc(explainerAlt)}" muted loop playsinline preload="metadata">
      ${explainerVideoWebm ? `<source src="${esc(explainerVideoWebm)}" type="video/webm">` : ""}
      <source src="${esc(explainerVideo)}" type="video/mp4">
    </video>
    <button type="button" class="ex-toggle" aria-label="Play animation">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path class="i-play" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"></path>
        <g class="i-pause" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></g>
      </svg>
    </button>
  </div>
  <figcaption class="label">Explainer · the article in under a minute</figcaption>
</figure>`;
}

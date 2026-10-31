// Story blocks: a small set of directives Brandon can drop into an article's markdown.
// Articles without them render exactly as before.
//
//   ::pull[A slide deck can't fail a build.]       a billboard pull quote, chosen by hand
//   :::sidenote                                     a margin note on wide screens,
//   Text of the note.                               inline under its paragraph on phones
//   :::
//   ::chapter[The vendor leaves]                    a full-width chapter break (an h2, so it
//                                                   joins the chapter rail)
//   ::figure[Caption]{src="/articles/x/a.png" alt="…" dither}
//                                                   a figure; with `dither` it resolves from
//                                                   noise to signal as it scrolls into view
//   ::explainer                                     places the explainer video here instead
//                                                   of above the body
//
// Needs remark-directive before it. Anything that parses as a directive but isn't one of
// these (a stray "word:word" in prose) is turned back into the text it came from.
import { explainerHtml } from "../lib/explainer.mjs";

const text = (value) => ({ type: "text", value });

function toText(node) {
  const marker = node.type === "textDirective" ? ":" : node.type === "leafDirective" ? "::" : ":::";
  const label = node.children?.length ? [text("["), ...node.children, text("]")] : [];
  return [text(marker + node.name), ...label];
}

export function remarkStory() {
  return (tree, file) => {
    const fm = file.data?.astro?.frontmatter ?? {};
    let explainerPlaced = false;

    function visit(node, index, parent) {
      if (node.children) {
        // Iterate over a copy: replacements can change the length.
        for (let i = 0; i < node.children.length; i++) {
          const before = node.children.length;
          visit(node.children[i], i, node);
          i += node.children.length - before;
        }
      }
      if (!parent || !/Directive$/.test(node.type)) return;

      const attrs = node.attributes ?? {};
      const replace = (...nodes) => parent.children.splice(index, 1, ...nodes);

      if (node.type === "leafDirective" && node.name === "pull") {
        node.data = { hName: "p", hProperties: { className: ["pull"] } };
        return;
      }
      if (node.type === "containerDirective" && node.name === "sidenote") {
        node.data = { hName: "aside", hProperties: { className: ["sidenote"] } };
        return;
      }
      if (node.type === "leafDirective" && node.name === "chapter") {
        replace({ type: "heading", depth: 2, children: node.children, data: { hProperties: { className: ["chapter-break"] } } });
        return;
      }
      if (node.type === "leafDirective" && node.name === "figure") {
        if (!attrs.src || !attrs.alt) throw new Error(`::figure needs src and alt (in ${file.path ?? "an article"})`);
        const dither = "dither" in attrs;
        const img = { type: "image", url: attrs.src, alt: attrs.alt, data: { hProperties: { loading: "lazy" } } };
        const children = [
          dither
            ? { type: "paragraph", data: { hName: "div", hProperties: { className: ["fig-frame"] } }, children: [img] }
            : img,
        ];
        if (node.children?.length) children.push({ type: "paragraph", data: { hName: "figcaption", hProperties: { className: ["label"] } }, children: node.children });
        replace({ type: "paragraph", data: { hName: "figure", hProperties: { className: ["story-figure"], ...(dither && { "data-resolve": "" }) } }, children });
        return;
      }
      if (node.type === "leafDirective" && node.name === "explainer") {
        if (!fm.explainerVideo) throw new Error(`::explainer used without explainerVideo in the frontmatter (in ${file.path ?? "an article"})`);
        if (explainerPlaced) throw new Error(`::explainer used twice (in ${file.path ?? "an article"})`);
        explainerPlaced = true;
        fm.explainerInline = true;
        replace({ type: "html", value: explainerHtml(fm) });
        return;
      }
      // Not a story block: give the text back.
      if (node.type === "textDirective") replace(...toText(node));
      else replace({ type: "paragraph", children: toText(node) });
    }

    visit(tree, 0, null);
  };
}

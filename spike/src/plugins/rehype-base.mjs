// Prefixes root-relative asset paths (src, poster, srcset) and links to other articles
// with the site's base, so markdown written for the live site works under /spike.
const ASSET_ATTRS = ["src", "poster"];

export function rehypeBase({ base = "" } = {}) {
  const prefix = (v) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith(base + "/") ? base + v : v);
  function walk(node) {
    if (node.type === "element" && node.properties) {
      const p = node.properties;
      for (const a of ASSET_ATTRS) if (p[a]) p[a] = prefix(p[a]);
      if (typeof p.srcSet === "string") p.srcSet = p.srcSet.split(",").map((s) => prefix(s.trim())).join(", ");
      if (node.tagName === "a" && typeof p.href === "string" && p.href.startsWith("/articles/")) p.href = prefix(p.href);
    }
    if (node.children) node.children.forEach(walk);
  }
  return (tree) => walk(tree);
}

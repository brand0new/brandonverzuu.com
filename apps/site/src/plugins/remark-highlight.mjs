// ==text== in markdown becomes a <mark>: the article's one signal highlight.
const RE = /==([^=\n]+?)==/g;

export function remarkHighlight() {
  function walk(node) {
    if (!node.children) return;
    const out = [];
    for (const child of node.children) {
      if (child.type !== "text" || !child.value.includes("==")) {
        walk(child);
        out.push(child);
        continue;
      }
      let last = 0;
      for (const m of child.value.matchAll(RE)) {
        if (m.index > last) out.push({ type: "text", value: child.value.slice(last, m.index) });
        out.push({ type: "emphasis", data: { hName: "mark" }, children: [{ type: "text", value: m[1] }] });
        last = m.index + m[0].length;
      }
      if (last < child.value.length) out.push({ type: "text", value: child.value.slice(last) });
    }
    node.children = out;
  }
  return (tree) => walk(tree);
}

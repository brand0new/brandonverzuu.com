// Write the change once, apply it everywhere: the explainer for
// content/articles/capture-api-changes-with-overlay.md.
//
// Render with: npm run explainer:render -- overlay --slug capture-api-changes-with-overlay

const spec = (flagged) => ({
  type: "card", x: 360, y: 150, w: 560, h: 260, at: 0.4, mono: true, title: "petstore.openapi.yaml", icon: "file-fill",
  v: flagged ? "terra" : "neutral",
  lines: ["GET   /pets", "POST  /pets", { text: "      deprecated: true", color: flagged ? "terra" : "text" }, "GET   /pets/{id}"],
});

defineStory({
  title: "Overlay Specification",
  headline: "Capture API changes with Overlay",
  scenes: [
    {
      dur: 5, tone: "terra", caption: "An endpoint in your API description gets flagged as deprecated.",
      els: [spec(false)],
    },
    {
      dur: 5.5, tone: "terra", caption: "But nothing tells consumers when it actually goes away.",
      els: [
        { type: "halo", x: 360, y: 150, w: 560, h: 260, pad: 42, at: 0.8, level: 0.5 },
        { ...spec(true), at: 0.2 },
        { type: "chip", x: 330, y: 452, w: 300, h: 56, at: 1.6, icon: "multiply-circle-fill", v: "terra", text: "No Sunset date" },
        { type: "chip", x: 650, y: 452, w: 300, h: 56, at: 1.9, icon: "multiply-circle-fill", v: "terra", text: "No Deprecation header" },
      ],
    },
    {
      dur: 6.5, tone: "porc", caption: "An overlay describes the change once, aimed with a JSONPath target.",
      els: [
        { type: "card", x: 160, y: 180, w: 960, h: 200, at: 0.4, v: "porc", mono: true, icon: "file-plus-fill",
          title: "protocol-deprecation.overlay.yaml",
          lines: [{ text: "target: $.paths.*[?(@.deprecated == true)].responses.*", color: "porc" },
                  "update:", "  headers: Deprecation, Sunset, Link"] },
      ],
    },
    {
      dur: 6, tone: "porc", caption: "Apply it in the pipeline, and every flagged endpoint gets the headers.",
      els: [
        { type: "card", x: 100, y: 176, w: 300, h: 156, at: 0.3, mono: true, lines: ["POST  /pets", { text: "deprecated: true", color: "terra" }] },
        { type: "line", x1: 400, x2: 500, y: 254, at: 1.0, arrow: true, color: "p400" },
        { type: "chip", x: 510, y: 226, w: 240, h: 56, at: 1.1, mono: true, center: true, v: "porc", text: "bump overlay" },
        { type: "line", x1: 760, x2: 852, y: 254, at: 1.7, arrow: true, color: "p400" },
        { type: "card", x: 860, y: 140, w: 380, h: 230, at: 1.9, v: "porc", mono: true, title: "final.openapi.yaml",
          lines: ["Deprecation: @1737722995", "Sunset: 31 Dec 2026", { text: "Link: rel=\"deprecation\"", color: "porc" }] },
      ],
    },
    {
      dur: 5.5, tone: "terra", caption: "Mind the limits: it isn't schema-aware, and tool support varies.",
      els: ["Not aware of the OpenAPI schema", "JSONPath expressions per RFC 9535", "Few tools support it yet"].map((text, i) => (
        { type: "chip", x: 300, y: 170 + i * 92, w: 680, h: 68, at: 0.4 + i * 0.4, icon: "exclamation-triangle-fill", v: "neutral", text })),
    },
    {
      dur: 7, tone: "porc", caption: "One protocol, written once, applied the same way to every API.",
      els: compareEls(
        { label: "Before · by hand, per API", nodes: [
          { icon: "flag-fill", label: "Deprecated flag" },
          { icon: "edit-pen-fill", label: "Headers by hand", sub: "per team", v: "terra" },
          { icon: "file-fill", label: "Description", sub: "drifts", v: "terra" }] },
        { label: "After · one overlay", nodes: [
          { icon: "flag-fill", label: "Deprecated flag" },
          { icon: "file-plus-fill", label: "Overlay", sub: "in the pipeline", v: "porc" },
          { icon: "check-circle-fill", label: "Description", sub: "consistent headers", v: "porc" }] }),
    },
  ],
});

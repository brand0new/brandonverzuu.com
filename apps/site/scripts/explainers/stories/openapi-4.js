// Start from what the API does: the explainer for
// content/articles/everything-about-openapi-4.md. Moonwalk was still in
// development when the article was written, so the title says so.
//
// Render with: npm run explainer:render -- openapi-4 --slug everything-about-openapi-4

const v3 = (flag) => ({
  type: "card", x: 300, y: 150, w: 680, h: 270, mono: true, icon: "file-fill", title: "openapi: 3.0.0", v: flag ? "terra" : "neutral",
  lines: ["paths:", "  /pets:",
    { text: flag ? "    post: 201 · 404 · 5XX" : "    post: 201 · 404 · 5XX", color: flag ? "terra" : "text" },
    { text: "    get:  200 · 404 · 5XX", color: flag ? "terra" : "text" }],
});

defineStory({
  title: "OpenAPI 4 · subject to change",
  headline: "Everything you need to know about OpenAPI version 4",
  scenes: [
    {
      dur: 5, tone: "terra", caption: "OpenAPI 3 starts from HTTP: paths, then methods.",
      els: [{ ...v3(false), at: 0.4 }],
    },
    {
      dur: 5.5, tone: "terra", caption: "So shared responses repeat under every single method.",
      els: [
        { type: "halo", x: 300, y: 150, w: 680, h: 270, pad: 40, at: 1.0, level: 0.45 },
        { ...v3(true), at: 0.2 },
        { type: "chip", x: 440, y: 452, w: 400, h: 56, at: 1.4, icon: "copy-fill", v: "terra", text: "404 and 5XX, twice" },
      ],
    },
    {
      dur: 6, tone: "porc", caption: "Moonwalk starts from what the API does: named requests.",
      els: [
        { type: "eyebrow", x: 200, y: 196, text: "pets · requests", color: "porc", at: 0.3 },
        { type: "chip", x: 200, y: 236, w: 410, h: 84, at: 0.6, icon: "plus-circle-fill", v: "porc", text: "createPet · post · 201" },
        { type: "chip", x: 670, y: 236, w: 410, h: 84, at: 1.0, icon: "search-fill", v: "porc", text: "getPets · get · 200" },
        { type: "text", x: 200, y: 366, text: "One HTTP method no longer means one operation.", size: 24, weight: 400, color: "neutral", at: 1.8 },
      ],
    },
    {
      dur: 6.5, tone: "porc", caption: "Shared responses are declared once, for a path or the whole API.",
      els: [
        { type: "card", x: 140, y: 120, w: 1000, h: 400, at: 0.3, v: "porc", title: "API", icon: "stack-fill" },
        { type: "card", x: 180, y: 190, w: 920, h: 220, at: 0.7, v: "neutral", title: "Path · pets", icon: "folder-fill" },
        { type: "chip", x: 220, y: 262, w: 410, h: 56, at: 1.1, v: "porc", text: "createPet · 201" },
        { type: "chip", x: 650, y: 262, w: 410, h: 56, at: 1.3, v: "porc", text: "getPets · 200" },
        { type: "chip", x: 220, y: 334, w: 840, h: 56, at: 1.9, mono: true, v: "porc", icon: "check-circle-fill", text: "pathResponses · notFound 404" },
        { type: "chip", x: 180, y: 436, w: 920, h: 56, at: 2.6, mono: true, v: "porc", icon: "check-circle-fill", text: "apiResponses · serverError 5xx" },
      ],
    },
    {
      dur: 5.5, tone: "porc", caption: "Deployments get their own section, each with its own security.",
      els: [
        { type: "card", x: 160, y: 196, w: 440, h: 170, at: 0.4, v: "porc", icon: "globe-fill", title: "PROD", mono: true,
          lines: ["api.example.com", { text: "security: oauth", color: "porc" }] },
        { type: "card", x: 680, y: 196, w: 440, h: 170, at: 0.9, v: "neutral", icon: "globe-fill", title: "SBX", mono: true,
          lines: ["api-sbx.example.com", { text: "security: basic", color: "neutral" }] },
      ],
    },
    {
      dur: 7, tone: "porc", caption: "A description built around purpose, not HTTP mechanics.",
      els: compareEls(
        { label: "Before · OpenAPI 3", nodes: [
          { icon: "file-fill", label: "HTTP method" },
          { icon: "copy-fill", label: "Responses", sub: "repeated per method", v: "terra" },
          { icon: "copy-fill", label: "Per-environment files", v: "terra" }] },
        { label: "After · OpenAPI 4", nodes: [
          { icon: "zap-fill", label: "API function" },
          { icon: "stack-fill", label: "Scoped responses", sub: "declared once", v: "porc" },
          { icon: "globe-fill", label: "Deployments", sub: "per environment", v: "porc" }] }),
    },
  ],
});

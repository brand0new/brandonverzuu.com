// Automate the binary, discuss the spectrum: the explainer for
// content/articles/automate-api-governance.md.
//
// Render with: npm run explainer:render -- api-governance --slug automate-api-governance

defineStory({
  title: "API governance",
  headline: "Automate your API governance in 15 minutes",
  scenes: [
    {
      dur: 5, tone: "terra", caption: "API governance often lives in meetings and documents.",
      els: [
        { type: "node", x: 340, y: 300, at: 0.3, n: { v: "neutral", icon: "users-fill", label: "Review board" } },
        { type: "line", x1: 420, x2: 840, y: 300, at: 1.1, arrow: true },
        { type: "card", x: 860, y: 196, w: 300, h: 208, at: 1.5, icon: "note-text-fill", title: "API guidelines",
          lines: ["Use camelCase", "Describe every object", "Add every response"] },
      ],
    },
    {
      dur: 5.5, tone: "terra", caption: "By the time teams build, half of it is forgotten.",
      els: [
        { type: "card", x: 860, y: 196, w: 300, h: 208, at: 0, dissolveAt: 1.0, dir: 1, icon: "note-text-fill", title: "API guidelines",
          lines: ["Use camelCase", "Describe every object", "Add every response"] },
        { type: "node", x: 220, y: 300, at: 0.4, n: { v: "neutral", icon: "user-fill", label: "Developer" } },
        { type: "halo", x: 400, y: 196, w: 400, h: 208, pad: 42, at: 2.4, level: 0.55 },
        { type: "card", x: 400, y: 196, w: 400, h: 208, at: 1.2, v: "terra", title: "petstore.openapi.yml", mono: true,
          lines: ["Pet:", { text: "  home-address: string", color: "terra" }, { text: "  description: —", color: "terra" }] },
      ],
    },
    {
      dur: 6, tone: "porc", caption: "Split the decisions. Some have a yes-or-no answer.",
      els: [
        { type: "eyebrow", x: 200, y: 140, text: "Binary · automate it", color: "porc", at: 0.3 },
        ...["Casing", "Descriptions", "Responses", "Structure"].map((text, i) => (
          { type: "chip", x: 200, y: 176 + i * 76, w: 380, h: 62, text, icon: "check-circle-fill", v: "porc", at: 0.6 + i * 0.3 })),
        { type: "eyebrow", x: 700, y: 140, text: "A spectrum · discuss it", color: "terra", at: 1.8 },
        ...["Operations", "Parameters", "Endpoints"].map((text, i) => (
          { type: "chip", x: 700, y: 176 + i * 76, w: 380, h: 62, text, icon: "message-dots-fill", v: "neutral", at: 2.1 + i * 0.3 })),
      ],
    },
    {
      dur: 6, tone: "porc", caption: "A linter enforces the binary ones on every commit.",
      els: [
        { type: "node", x: 300, y: 196, at: 0.3, n: { v: "neutral", icon: "file-fill", label: "API description" } },
        { type: "line", x1: 372, x2: 568, y: 196, at: 0.9, arrow: true, color: "p400" },
        { type: "node", x: 640, y: 196, at: 1.1, n: { v: "porc", icon: "filter-fill", label: "Linter ruleset" } },
        { type: "line", x1: 712, x2: 908, y: 196, at: 1.7, arrow: true, color: "p400" },
        { type: "node", x: 980, y: 196, at: 1.9, n: { v: "porc", icon: "check-circle-fill", label: "Pipeline" } },
        { type: "card", x: 220, y: 372, w: 840, h: 150, at: 2.6, mono: true, lh: 36,
          lines: [{ text: "error  Object must have a description", color: "terra" },
                  { text: "warn   Use the 'A … is a … that …' template", color: "neutral" },
                  { text: "pass   casing, responses, structure", color: "porc" }] },
      ],
    },
    {
      dur: 5, tone: "porc", caption: "Design decisions stay a conversation, coached by an enablement team.",
      els: [
        { type: "stream", x1: 420, x2: 860, y: 300, color: "porc", at: 1.2, density: 0.6 },
        { type: "node", x: 340, y: 300, at: 0.3, n: { v: "neutral", icon: "users-fill", label: "Teams" } },
        { type: "node", x: 940, y: 300, at: 0.7, n: { v: "porc", icon: "light-bulb-fill", label: "Enablement team", sub: "coaches, never a gate" } },
      ],
    },
    {
      dur: 7, tone: "porc", caption: "As autonomous as possible, and as expert as needed.",
      els: compareEls(
        { label: "Before · governance in meetings", nodes: [
          { icon: "users-fill", label: "Review board" },
          { icon: "note-text-fill", label: "Guidelines", sub: "half forgotten", v: "terra" },
          { icon: "user-fill", label: "Developer", sub: "guesses", v: "terra" }] },
        { label: "After · governance in the pipeline", nodes: [
          { icon: "file-fill", label: "API description" },
          { icon: "filter-fill", label: "Linter", v: "porc" },
          { icon: "check-circle-fill", label: "Pipeline", sub: "consistent by default", v: "porc" }] }),
    },
  ],
});

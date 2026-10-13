// A route, not a ladder: the explainer for
// content/articles/maturity-models-and-tech.md.
//
// Render with: npm run explainer:render -- maturity-model --slug maturity-models-and-tech

// Focus areas and their capabilities: [letter, stage column 0-5, state].
// "met" = requirements met, "next" = the next reasonable move, "later".
const AREAS = [
  ["API design", [["A", 0, "met"], ["B", 2, "met"], ["C", 4, "later"]]],
  ["Versioning", [["A", 1, "met"], ["B", 3, "next"]]],
  ["Security", [["A", 0, "met"], ["B", 1, "met"], ["C", 3, "next"], ["D", 5, "later"]]],
  ["Documentation", [["A", 1, "met"], ["B", 5, "later"]]],
  ["Lifecycle", [["A", 2, "next"], ["B", 5, "later"]]],
];
const cellX = (k) => 440 + k * 112, rowY = (r) => 160 + r * 70;
const matrix = (span) => [
  ...[1, 2, 3, 4, 5, 6].map((n, k) => ({ type: "text", x: cellX(k) + 48, y: 122, text: String(n), size: 18, align: "center", w: 60, color: "neutral", at: 0.3, span })),
  ...AREAS.flatMap(([area, caps], r) => [
    { type: "text", x: 140, y: rowY(r) + 13, text: area, size: 22, color: "text", at: 0.4 + r * 0.15, span },
    ...caps.map(([letter, k, state]) => ({ type: "chip", x: cellX(k), y: rowY(r), w: 96, h: 52, center: true, text: letter,
      v: state === "met" ? "porc" : "neutral", at: 0.8 + r * 0.15 + k * 0.05, span })),
  ]),
];
const nextMoves = AREAS.flatMap(([, caps], r) => caps.filter(([, , s]) => s === "next").map(([letter, k]) => [letter, k, r]));

defineStory({
  title: "Focus area maturity model",
  headline: "What should we do next? Ask a focus area maturity model",
  scenes: [
    {
      dur: 5.5, tone: "terra", caption: "“What should we do next?” Everyone has a different answer.",
      els: [
        ...[["A service mesh", 100, 150], ["Lock down the gateway", 880, 150], ["An API marketplace", 100, 420], ["Naming conventions", 880, 420]].map(([text, x, y], i) => (
          { type: "chip", x, y, w: 300, h: 60, at: 1.0 + i * 0.35, icon: "message-dots-fill", v: "neutral", text })),
        { type: "node", x: 640, y: 290, at: 0.3, n: { v: "neutral", icon: "user-fill", label: "Management" } },
      ],
    },
    {
      dur: 5.5, tone: "terra", caption: "A five-level ladder squeezes all of it into one number.",
      els: [
        ...[5, 4, 3, 2, 1].map((n, i) => ({ type: "chip", x: 300, y: 130 + i * 74, w: 420, h: 58, center: true, at: 0.3 + (4 - i) * 0.2,
          v: n === 3 ? "terra" : "neutral", text: `Level ${n}` })),
        { type: "text", x: 800, y: 270, text: "One number", size: 30, color: "white", at: 1.6 },
        { type: "text", x: 800, y: 314, text: "for an uneven landscape", size: 22, weight: 400, color: "neutral", at: 1.9 },
      ],
    },
    {
      dur: 6.5, tone: "porc", caption: "A focus area model gives each area its own stages.",
      els: matrix(2),
    },
    {
      dur: 6, tone: "porc", caption: "Checkable requirements place each area. The next moves light up.",
      els: nextMoves.flatMap(([letter, k, r], i) => [
        { type: "halo", x: cellX(k), y: rowY(r), w: 96, h: 52, pad: 28, at: 0.8 + i * 0.4, level: 0.55 },
        { type: "chip", x: cellX(k), y: rowY(r), w: 96, h: 52, center: true, text: letter, v: "terra", at: 0.6 + i * 0.4 },
      ]),
    },
    {
      dur: 5.5, tone: "porc", caption: "The unmet requirements for those moves become the backlog.",
      els: [
        ...["Lifecycle · A", "Versioning · B", "Security · C"].map((text, i) => (
          { type: "chip", x: 120, y: 190 + i * 84, w: 340, h: 62, at: 0.3 + i * 0.3, v: "terra", icon: "goals-fill", text })),
        { type: "line", x1: 476, x2: 640, y: 305, at: 1.4, arrow: true, color: "p400" },
        { type: "card", x: 660, y: 170, w: 520, h: 270, at: 1.7, v: "porc", icon: "clipboard-fill", title: "Backlog",
          lines: ["Unmet requirements for Lifecycle A", "Unmet requirements for Versioning B", "Unmet requirements for Security C"] },
      ],
    },
    {
      dur: 7, tone: "porc", caption: "Is your answer to “what next?” one you could defend?",
      els: compareEls(
        { label: "Before · a matter of opinion", nodes: [
          { icon: "message-dots-fill", label: "Five opinions" },
          { icon: "megaphone-a-fill", label: "Loudest wins", v: "terra" },
          { icon: "coin-a-fill", label: "Budget spent", sub: "on the wrong room", v: "terra" }] },
        { label: "After · a route", nodes: [
          { icon: "layout-grid-fill", label: "Focus areas" },
          { icon: "check-circle-fill", label: "Requirements", sub: "met or not met", v: "porc" },
          { icon: "clipboard-fill", label: "Backlog", sub: "the next moves", v: "porc" }] }),
    },
  ],
});

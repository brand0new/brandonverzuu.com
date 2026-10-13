// Say in which order the calls belong: the explainer for
// content/articles/improving-dx-with-arazzo.md.
//
// Render with: npm run explainer:render -- arazzo --slug improving-dx-with-arazzo

const ENDPOINTS = ["/pet/getPet", "/pets", "/orders", "/orders/orderPet", "/discounts", "/discounts/coupons"];
const STEPS = [["1 · Pushed auth request", "$statusCode == 200"], ["2 · Authorization code", "$statusCode == 302"], ["3 · Token exchange", "$statusCode == 200"]];
const steps = (span) => STEPS.flatMap(([title, crit], i) => [
  { type: "card", x: 100 + i * 380, y: 160, w: 320, h: 124, at: 0.4 + i * 0.5, span, v: "porc", title, lines: [{ text: crit, mono: true, color: "porc" }] },
  ...(i < 2 ? [{ type: "line", x1: 424 + i * 380, x2: 476 + i * 380, y: 222, at: 0.8 + i * 0.5, span, arrow: true, color: "p400" }] : []),
]);

defineStory({
  title: "Arazzo Specification",
  headline: "Improving developer experience with Arazzo",
  scenes: [
    {
      dur: 5, tone: "terra", caption: "OpenAPI lists every operation, but not the order to call them in.",
      els: ENDPOINTS.map((text, i) => (
        { type: "chip", x: 140 + (i % 3) * 340, y: 190 + Math.floor(i / 3) * 96, w: 320, h: 64, at: 0.3 + i * 0.2, mono: true, center: true, v: "neutral", text })),
    },
    {
      dur: 5.5, tone: "terra", caption: "So consumers guess, or go and ask a colleague.",
      els: [
        { type: "halo", around: [220, 300], at: 1.6, level: 0.5 },
        { type: "node", x: 220, y: 300, at: 0.3, n: { v: "terra", icon: "user-fill", label: "Consumer", sub: "guessing" } },
        ...["Call /discounts first?", "/orders or /orders/orderPet?", "Which status means done?"].map((text, i) => (
          { type: "chip", x: 460, y: 180 + i * 88, w: 620, h: 64, at: 0.8 + i * 0.45, icon: "question-mark-circle-fill", v: "neutral", text })),
      ],
    },
    {
      dur: 6, tone: "porc", caption: "An Arazzo workflow declares the steps, in order.",
      els: [
        { type: "text", x: 100, y: 116, text: "workflowId: OIDC-authorize-AuthzCode-PAR", mono: true, size: 19, color: "neutral", at: 0.2, span: 2 },
        ...steps(2),
      ],
    },
    {
      dur: 6, tone: "porc", caption: "Each step has success criteria and passes its outputs on.",
      els: [
        { type: "line", x1: 160, x2: 840, y: 400, at: 0.4, draw: 1.8, color: "p400" },
        { type: "packet", x1: 160, x2: 840, y: 400, at: 0.6, dur: 1.8 },
        { type: "chip", x: 860, y: 370, w: 320, h: 60, at: 2.2, mono: true, icon: "key-fill", v: "porc", text: "access_token" },
      ],
    },
    {
      dur: 5.5, tone: "porc", caption: "Readable by people, and by machines, language models included.",
      els: [
        { type: "stream", x1: 300, x2: 520, y: 300, color: "porc", at: 1.2, density: 0.5 },
        { type: "stream", x1: 760, x2: 980, y: 300, color: "porc", at: 1.2, density: 0.5, seed: 13 },
        { type: "node", x: 220, y: 300, at: 0.6, n: { v: "neutral", icon: "user-fill", label: "Developer" } },
        { type: "chip", x: 520, y: 270, w: 240, h: 60, at: 0.3, mono: true, center: true, v: "porc", text: "arazzo.yaml" },
        { type: "node", x: 1060, y: 300, at: 0.9, n: { v: "neutral", icon: "robot-fill", label: "LLM agent" } },
      ],
    },
    {
      dur: 7, tone: "porc", caption: "The producer's intent, written down instead of passed on by word of mouth.",
      els: compareEls(
        { label: "Before · OpenAPI alone", nodes: [
          { icon: "user-fill", label: "Consumer" },
          { icon: "question-mark-circle-fill", label: "Six endpoints", sub: "in no order", v: "terra" },
          { icon: "users-fill", label: "Ask a colleague", v: "terra" }] },
        { label: "After · OpenAPI plus Arazzo", nodes: [
          { icon: "user-fill", label: "Consumer" },
          { icon: "clipboard-fill", label: "Workflow", sub: "steps and criteria", v: "porc" },
          { icon: "key-fill", label: "Token", sub: "in three steps", v: "porc" }] }),
    },
  ],
});

// Let the gateway publish the message: the explainer for
// content/articles/azure-native-service-bus-publishing-with-api-management.md.
//
// Render with: npm run explainer:render -- service-bus --slug azure-native-service-bus-publishing-with-api-management

const client = { v: "neutral", icon: "mobile-phone-fill", label: "Client" };
const apim = { v: "neutral", icon: "server-2-fill", label: "API Management" };
const bus = { v: "neutral", icon: "inbox-fill", label: "Service Bus" };

defineStory({
  title: "Cloud integration",
  headline: "Native Service Bus publishing with API Management",
  scenes: [
    {
      dur: 5, tone: "terra", caption: "An API call often needs to kick off work in the background.",
      els: [
        { type: "node", x: 220, y: 300, at: 0.3, n: client },
        { type: "line", x1: 288, x2: 572, y: 300, at: 1.0, arrow: true },
        { type: "node", x: 640, y: 300, at: 0.6, n: apim },
        { type: "line", x1: 708, x2: 992, y: 300, at: 1.3, arrow: true, dash: true, color: "terra" },
        { type: "node", x: 1060, y: 300, at: 0.9, n: bus },
      ],
    },
    {
      dur: 5.5, tone: "terra", caption: "So you build a Function whose only job is to forward it.",
      els: [
        { type: "packet", x1: 248, x2: 1052, y: 300, at: 2.6, dur: 2.2, color: "terra" },
        { type: "node", x: 180, y: 300, at: 0.3, span: 2, n: client },
        { type: "line", x1: 248, x2: 432, y: 300, at: 0.9, arrow: true },
        { type: "node", x: 500, y: 300, at: 0.5, span: 2, n: apim },
        { type: "line", x1: 568, x2: 752, y: 300, at: 1.4, arrow: true, color: "terra" },
        { type: "halo", around: [820, 300], at: 2.2, level: 0.55 },
        { type: "node", x: 820, y: 300, at: 1.1, span: 2, dissolveAt: 6.1, dir: 1,
          n: { v: "terra", icon: "zap-fill", label: "Function app", sub: "build · deploy · patch" } },
        { type: "line", x1: 888, x2: 1052, y: 300, at: 1.9, arrow: true, color: "terra" },
        { type: "node", x: 1120, y: 300, at: 0.7, span: 2, n: bus },
      ],
    },
    {
      dur: 6, tone: "porc", caption: "Now API Management publishes to Service Bus itself.",
      els: [
        { type: "line", x1: 248, x2: 432, y: 300, at: 0.2, arrow: true },
        { type: "stream", x1: 568, x2: 1052, y: 300, color: "porc", at: 2.2, density: 0.6 },
        { type: "line", x1: 568, x2: 1052, y: 300, at: 2.0, arrow: true, color: "p400" },
        { type: "chip", x: 300, y: 446, w: 400, h: 58, at: 2.6, mono: true, center: true, v: "porc", text: "<send-service-bus-message>" },
      ],
    },
    {
      dur: 5.5, tone: "porc", caption: "The client gets a 201 straight away; the work happens later.",
      els: [
        { type: "node", x: 220, y: 300, at: 0.3, n: client },
        { type: "line", x1: 288, x2: 572, y: 278, at: 0.9, arrow: true, color: "p400" },
        { type: "line", x1: 572, x2: 288, y: 322, at: 1.6, arrow: true, color: "porc" },
        { type: "chip", x: 330, y: 344, w: 200, h: 52, at: 1.9, mono: true, center: true, v: "porc", text: "201 Created" },
        { type: "node", x: 640, y: 300, at: 0.5, n: { ...apim, v: "porc" } },
        { type: "stream", x1: 708, x2: 992, y: 300, color: "porc", at: 2.4, density: 0.6 },
        { type: "packet", x1: 708, x2: 992, y: 300, at: 2.6, dur: 1.2 },
        { type: "node", x: 1060, y: 300, at: 0.7, n: { ...bus, v: "porc" } },
      ],
    },
    {
      dur: 5.5, tone: "terra", caption: "It's one-way. If the client needs an answer, keep forward-request.",
      els: [
        { type: "halo", around: [220, 300], at: 1.8, level: 0.5 },
        { type: "node", x: 220, y: 300, at: 0.3, n: { ...client, v: "terra", sub: "waiting for a reply" } },
        { type: "line", x1: 992, x2: 660, y: 300, at: 1.0, arrow: true, dash: true, color: "terra" },
        { type: "chip", x: 410, y: 272, w: 220, h: 56, at: 1.7, icon: "multiply-circle-fill", v: "terra", text: "no reply" },
        { type: "node", x: 1060, y: 300, at: 0.5, n: { v: "neutral", icon: "users-fill", label: "Consumer" } },
      ],
    },
    {
      dur: 7, tone: "porc", caption: "One policy instead of a Function to build and maintain.",
      els: compareEls(
        { label: "Before · a bridge you maintain", nodes: [
          { icon: "mobile-phone-fill", label: "Client" },
          { icon: "server-2-fill", label: "API Management" },
          { icon: "zap-fill", label: "Function app", sub: "build · deploy · patch", v: "terra" },
          { icon: "inbox-fill", label: "Service Bus" }] },
        { label: "After · native policy", nodes: [
          { icon: "mobile-phone-fill", label: "Client" },
          { icon: "server-2-fill", label: "API Management", sub: "publishes directly", v: "porc" },
          { icon: "inbox-fill", label: "Service Bus", v: "porc" }] }),
    },
  ],
});

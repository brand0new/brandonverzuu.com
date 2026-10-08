// Eén bitcoin geef je maar één keer uit: the explainer for
// content/articles/begrijp-jij-bitcoin.md. Dutch, like the article.
//
// Render with: npm run explainer:render -- bitcoin --slug begrijp-jij-bitcoin

const BLOCKS = ["Blok n−3", "Blok n−2", "Blok n−1", "Blok n"];

defineStory({
  title: "Bitcoin",
  headline: "Begrijp jij bitcoin?",
  scenes: [
    {
      dur: 5, tone: "terra", caption: "Digitaal is alles te kopiëren. Waarom geld dan niet?",
      els: [
        { type: "node", x: 400, y: 300, at: 0.3, n: { v: "neutral", icon: "coin-a-fill", label: "Digitale munt" } },
        { type: "packet", x1: 470, x2: 810, y: 300, at: 1.4, dur: 1.0, color: "terra" },
        { type: "halo", around: [880, 300], at: 2.6, level: 0.5 },
        { type: "node", x: 880, y: 300, at: 2.3, n: { v: "terra", icon: "copy-fill", label: "Een kopie" } },
      ],
    },
    {
      dur: 5.5, tone: "terra", caption: "Zonder controle geef je dezelfde munt gewoon twee keer uit.",
      els: [
        { type: "node", x: 240, y: 310, at: 0.3, compact: true, n: { v: "neutral", icon: "user-fill", label: "Ann" } },
        { type: "line", x1: 300, x2: 930, y: 200, at: 0.9, arrow: true },
        { type: "line", x1: 300, x2: 930, y: 420, at: 1.6, arrow: true, dash: true, color: "terra" },
        { type: "text", x: 615, y: 162, text: "1 BTC", size: 22, align: "center", color: "neutral", at: 1.2 },
        { type: "text", x: 615, y: 438, text: "dezelfde 1 BTC", size: 22, align: "center", color: "terra", at: 1.9 },
        { type: "node", x: 1000, y: 200, at: 1.0, compact: true, n: { v: "neutral", icon: "user-fill", label: "Bob" } },
        { type: "halo", around: [1000, 420, true], at: 2.3, level: 0.5 },
        { type: "node", x: 1000, y: 420, at: 1.7, compact: true, n: { v: "terra", icon: "user-fill", label: "Cas" } },
      ],
    },
    {
      dur: 6, tone: "porc", caption: "Bitcoin legt alle transacties vast in een keten van blokken.",
      els: BLOCKS.flatMap((title, i) => [
        { type: "card", x: 100 + i * 280, y: 210, w: 240, h: 160, at: 0.4 + i * 0.4, span: 2, v: i === 3 ? "porc" : "neutral",
          icon: "box-fill", title, lines: [{ text: "max. 1 MB", color: "neutral" }] },
        ...(i < 3 ? [{ type: "line", x1: 344 + i * 280, x2: 376 + i * 280, y: 290, at: 0.7 + i * 0.4, span: 2, arrow: true }] : []),
      ]),
    },
    {
      dur: 6, tone: "porc", caption: "Duizenden volledige nodes houden een kopie bij en controleren elke transactie.",
      els: [
        { type: "stream", x1: 140, x2: 1140, y: 440, color: "porc", at: 0.8, density: 0.6, rows: 1 },
        ...[260, 640, 1020].map((x, i) => (
          { type: "chip", x: x - 130, y: 410, w: 260, h: 60, at: 0.4 + i * 0.3, icon: "server-fill", v: "porc", text: "Volledige node" })),
      ],
    },
    {
      dur: 5.5, tone: "porc", caption: "Een tweede uitgave van dezelfde munt valt meteen op en wordt geweigerd.",
      els: [
        { type: "chip", x: 240, y: 190, w: 800, h: 72, at: 0.4, icon: "check-circle-fill", v: "porc", text: "Ann → Bob · 1 BTC · bevestigd" },
        { type: "halo", x: 240, y: 300, w: 800, h: 72, pad: 36, at: 1.6, level: 0.5 },
        { type: "chip", x: 240, y: 300, w: 800, h: 72, at: 1.2, icon: "multiply-circle-fill", v: "terra", text: "Ann → Cas · dezelfde 1 BTC · geweigerd" },
      ],
    },
    {
      dur: 7, tone: "porc", caption: "Een netwerk zonder centrale partij, waarin dubbel uitgeven niet kan.",
      els: compareEls(
        { label: "Zonder keten", nodes: [
          { icon: "coin-a-fill", label: "Digitale munt" },
          { icon: "copy-fill", label: "Kopie", v: "terra" },
          { icon: "users-fill", label: "Twee keer uitgegeven", v: "terra" }] },
        { label: "Met bitcoin", nodes: [
          { icon: "coin-a-fill", label: "Transactie" },
          { icon: "box-fill", label: "Keten van blokken", sub: "door iedereen gecontroleerd", v: "porc" },
          { icon: "check-circle-fill", label: "Eén keer uitgegeven", v: "porc" }] }),
    },
  ],
});

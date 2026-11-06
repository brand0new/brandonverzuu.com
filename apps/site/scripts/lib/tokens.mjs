// Noise to Signal: the one palette for the site, the covers and the contrast check.
//
// The site emits these as CSS custom properties (src/layouts/Base.astro), the cover
// script takes its default colours from `cover` (scripts/generate-cover.mjs), and
// scripts/check-contrast.mjs fails `npm run generate` when a pair in `pairs` drops
// below its WCAG AA threshold in either theme. Change a colour here and all three follow.

export const themes = {
  light: {
    paper: "#cfe3e7", // porcelain (192deg), tinted enough to read as a colour, never warm cream
    panel: "#bcd6dc", // a step deeper in the same hue
    ink: "#0f1a1d",
    muted: "#415960",
    line: "#97bbc4",
    accent: "#9a3916", // terracotta-heading, deepened so it stays AA on the porcelain panel
    dot: "#d97a4d", // terracotta, the dither "on" pixel in both themes
    signal: "#beff33", // signal chartreuse (79deg): fills, highlights, drops; never text on light paper
    "on-signal": "#0f1a1d",
    "signal-text": "#466600", // signal as text or a ring on light paper
    "signal-edge": "#0f1a1d", // keyline that lets a small drop read on light paper
  },
  dark: {
    paper: "#0f191c",
    panel: "#1d2e34",
    ink: "#e5eef0",
    muted: "#9db2b8",
    line: "#2f464d",
    accent: "#d97a4d",
    dot: "#d97a4d",
    signal: "#beff33",
    "on-signal": "#0f1a1d",
    "signal-text": "#beff33",
    "signal-edge": "transparent",
  },
};

// Pairs that carry text or meaning, with the ratio each must reach (4.5 for text, 3 for
// large text, focus rings and non-text marks). Dots and signal-on-paper are decorative by
// rule (dots are never text; signal on light paper is always a fill behind ink), so they
// aren't listed.
export const pairs = [
  { fg: "ink", bg: "paper", min: 4.5, use: "body text" },
  { fg: "ink", bg: "panel", min: 4.5, use: "text on panels" },
  { fg: "muted", bg: "paper", min: 4.5, use: "labels and metadata" },
  { fg: "muted", bg: "panel", min: 4.5, use: "labels on panels" },
  { fg: "accent", bg: "paper", min: 4.5, use: "links, pull quotes, numerals" },
  { fg: "accent", bg: "panel", min: 4.5, use: "links and numerals on panels" },
  { fg: "on-signal", bg: "signal", min: 4.5, use: "highlights and signal chips" },
  { fg: "signal-text", bg: "paper", min: 3, use: "focus rings" },
  { fg: "paper", bg: "ink", min: 4.5, use: "inverted buttons" },
];

// Defaults for scripts/generate-cover.mjs. Covers are re-dithered in the browser with the
// theme's own tokens, so these only decide the PNG files that ship as the no-JS fallback.
export const cover = {
  dot: themes.light.dot,
  darkBg: themes.dark.panel,
  lightBg: "#fbfbf8",
};

export function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// `--paper: #cfe3e7; …` for one theme, ready to drop into a CSS rule.
export function cssVars(theme) {
  return Object.entries(themes[theme])
    .map(([k, v]) => `--${k}:${v}`)
    .join(";");
}

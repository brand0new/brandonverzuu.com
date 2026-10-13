// Explainer kit: the drawing primitives every animated explainer shares.
//
// Loaded into a headless page by scripts/explainers/render.mjs, ahead of a
// story file (scripts/explainers/stories/*.js). Plain browser globals, no
// modules, so a story can call these directly. The look follows the
// "Animated explainers" section of the Brandon Verzuu design system:
// a dark zinc ground, General Sans, one resolved colour (porcelain) and one
// unresolved colour (terracotta), and elements that enter and leave through
// a 1-bit Bayer 4x4 dither stepped at 14 fps in 7px cells, never an opacity
// fade.
//
// Everything is a pure function of time `t` (seconds), so any frame can be
// rendered on its own and the video is deterministic.

const CELL = 7, FPS_D = 14;
// Two formats share every story: "landscape" (1280×720, the article embed)
// and "feed" (1080×1350, 4:5 for social feeds). Stories draw their scenes in
// landscape coordinates inside stage(); in the feed format the stage is
// scaled into the middle of the frame and the chrome is laid out around it.
const FORMAT = window.FORMAT === "feed" ? "feed" : "landscape";
const FEED = FORMAT === "feed";
const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const C = {
  ground: "#09090b", surface: "#18181b", zinc700: "#3f3f46", zinc800: "#27272a", line: "#52525c",
  text: "#e4e4e7", white: "#ffffff", gray400: "#99a1af",
  p300: "#a5cad4", p400: "#75aebb", p700: "#35616f", p950: "#1d2e34", terra: "#d97a4d",
};
const SANS = "'General Sans', system-ui, sans-serif";
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

// ---------- time and maths ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const q = (t) => Math.floor(t * FPS_D + 1e-6) / FPS_D; // dither steps run at 14 fps
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
function hash(n) { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }
const snap = (v) => Math.round(v / CELL) * CELL;
const bayer = (gx, gy) => B[(((gy / CELL) | 0) & 3) * 4 + (((gx / CELL) | 0) & 3)];

let tNow = 0;
function setTime(t) { tNow = t; }

// Dither level of an element: 0 → 1 over `dur` from `inAt`, back to 0 from `outAt`.
function lvl(t, inAt, dur = 0.6, outAt = null, outDur = 0.45) {
  const tq = q(t);
  let l = clamp((tq - inAt) / dur);
  if (outAt !== null) l = Math.min(l, 1 - clamp((tq - outAt) / outDur));
  return l;
}

// ---------- drawing ----------
function font(g, w, s) { g.font = `${w} ${s}px ${SANS}`; }

let PATHS = null;
// Draw a Mage icon by its Iconify name (e.g. "briefcase-fill"); window.ICONS
// is injected by render.mjs from @iconify-json/mage.
function icon(g, name, x, y, size, color) {
  if (!PATHS) PATHS = {};
  if (!PATHS[name]) {
    const body = window.ICONS[name];
    if (!body) throw new Error(`Unknown Mage icon: ${name}`);
    PATHS[name] = { stroke: /stroke="currentColor"/.test(body), p: [...body.matchAll(/ d="([^"]+)"/g)].map((m) => new Path2D(m[1])) };
  }
  const ic = PATHS[name];
  g.save(); g.translate(x, y); g.scale(size / 24, size / 24);
  if (ic.stroke) { g.strokeStyle = color; g.lineWidth = 1.5; g.lineCap = "round"; g.lineJoin = "round"; ic.p.forEach((p) => g.stroke(p)); }
  else { g.fillStyle = color; ic.p.forEach((p) => g.fill(p)); }
  g.restore();
}
// Uppercase label with 0.08em tracking (the design system's `eyebrow` style).
function eyebrow(g, text, x, y, color, size = 16) {
  font(g, 600, size); g.letterSpacing = `${size * 0.08}px`; g.fillStyle = color;
  g.textBaseline = "top"; g.textAlign = "left"; g.fillText(text.toUpperCase(), x, y); g.letterSpacing = "0px";
}
function wrap(g, text, maxW) {
  const words = text.split(" "), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

const V = {
  neutral: { bg: C.surface, bd: C.zinc700, ic: C.text },
  terra: { bg: C.surface, bd: C.terra, ic: C.terra },
  porc: { bg: C.p950, bd: C.p400, ic: C.p300 },
};
function rbox(g, x, y, w, h, r, v) {
  g.beginPath(); g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  g.fillStyle = v.bg; g.fill(); g.strokeStyle = v.bd; g.lineWidth = 1.5; g.stroke();
}

// Clip the context to the Bayer cells of a rectangle at `level`, run fn, restore.
function revealRect(level, x, y, w, h, fn) {
  if (level <= 0) return;
  ctx.save();
  if (level < 1) {
    ctx.beginPath();
    for (let gy = snap(y - CELL); gy < y + h + CELL; gy += CELL)
      for (let gx = snap(x - CELL); gx < x + w + CELL; gx += CELL)
        if (bayer(gx, gy) < level * 16) ctx.rect(gx, gy, CELL, CELL);
    ctx.clip();
  }
  fn(); ctx.restore();
}
function ditherFill(x, y, w, h, color, level) {
  ctx.fillStyle = color;
  for (let gy = snap(y); gy < y + h; gy += CELL)
    for (let gx = snap(x); gx < x + w; gx += CELL)
      if (bayer(gx, gy) < level * 16) ctx.fillRect(gx, gy, CELL, CELL);
}

// ---------- nodes ----------
// A large node: square tile with one icon, a label and an optional sub line.
const TILE = 136;
function node(g, cx, cy, n) {
  const v = V[n.v];
  rbox(g, cx - TILE / 2, cy - TILE / 2, TILE, TILE, 20, v);
  icon(g, n.icon, cx - 30, cy - 30, 60, v.ic);
  g.textAlign = "center"; g.textBaseline = "middle";
  font(g, 600, 26); g.fillStyle = C.text; g.fillText(n.label, cx, cy + TILE / 2 + 34);
  if (n.sub) { font(g, 400, 20); g.fillStyle = C.gray400; g.fillText(n.sub, cx, cy + TILE / 2 + 66); }
}
// A compact node, for side-by-side comparison frames.
const TILE2 = 96;
function cnode(g, cx, cy, n) {
  const v = V[n.v];
  rbox(g, cx - TILE2 / 2, cy - TILE2 / 2, TILE2, TILE2, 16, v);
  icon(g, n.icon, cx - 22, cy - 22, 44, v.ic);
  g.textAlign = "center"; g.textBaseline = "middle";
  font(g, 600, 22); g.fillStyle = C.text; g.fillText(n.label, cx, cy + TILE2 / 2 + 28);
  if (n.sub) { font(g, 400, 18); g.fillStyle = C.gray400; g.fillText(n.sub, cx, cy + TILE2 / 2 + 54); }
}

// ---------- sprites: offscreen renders that can dither in, or break apart ----------
const SPR = {};
function sprite(key, w, h, fn) {
  if (SPR[key]) return SPR[key];
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const g = cv.getContext("2d"); fn(g);
  const data = g.getImageData(0, 0, w, h).data, cells = [];
  for (let y = 0; y < h; y += CELL) for (let x = 0; x < w; x += CELL) {
    let filled = false;
    for (let yy = y; yy < Math.min(h, y + CELL) && !filled; yy += 2) for (let xx = x; xx < Math.min(w, x + CELL); xx += 2)
      if (data[(yy * w + xx) * 4 + 3] > 40) { filled = true; break; }
    if (filled) cells.push({ x, y, h1: hash(x * 13.1 + y * 7.7), h2: hash(x * 3.3 + y * 17.9 + 5), h3: hash(x * 9.1 + y * 2.3 + 11) });
  }
  return (SPR[key] = { cv, w, h, cells });
}
const nodeSprite = (key, n) => sprite(key, TILE + 180, TILE + 90, (g) => node(g, (TILE + 180) / 2, TILE / 2, n));
const cnodeSprite = (key, n) => sprite(key, TILE2 + 150, TILE2 + 70, (g) => cnode(g, (TILE2 + 150) / 2, TILE2 / 2, n));
// Place a node sprite centred on (cx, cy) of its tile, at a dither level.
function putNode(key, n, cx, cy, l) { const s = nodeSprite(key, n); drawSprite(s, cx - s.w / 2, cy - TILE / 2, l); }
function putCNode(key, n, cx, cy, l) { const s = cnodeSprite(key, n); drawSprite(s, cx - s.w / 2, cy - TILE2 / 2, l); }

function drawSprite(s, x, y, level) {
  if (level <= 0) return;
  if (level >= 1) { ctx.drawImage(s.cv, x, y); return; }
  ctx.save(); ctx.beginPath();
  for (const c of s.cells) { const gx = x + c.x, gy = y + c.y; if (bayer(snap(gx), snap(gy)) < level * 16) ctx.rect(gx, gy, CELL, CELL); }
  ctx.clip(); ctx.drawImage(s.cv, x, y); ctx.restore();
}
// Break a sprite into cells that drift away and thin out (p: 0 → 1).
// Use sparingly: it is the one particle effect, reserved for a story beat.
function dissolve(s, x, y, p, color, dir) {
  for (const c of s.cells) {
    const d = c.h1 * 0.55, k = (p - d) / 0.45;
    if (k <= 0) { ctx.drawImage(s.cv, c.x, c.y, CELL, CELL, x + c.x, y + c.y, CELL, CELL); continue; }
    if (c.h2 < k) continue;
    const e = easeOut(k);
    const px = x + c.x + dir * e * (160 + 260 * c.h3), py = y + c.y - e * (40 + 120 * c.h2) + Math.sin(c.h1 * 20) * e * 30;
    ctx.fillStyle = color; ctx.fillRect(snap(px), snap(py), CELL, CELL);
  }
}

// ---------- ambient texture (follows real time, never stops) ----------
// A flowing stream of cells between x1 and x2 around y, density 0..1.
function stream(x1, x2, y, t, color, density, seed, speed = 160, rows = 3) {
  if (density <= 0) return;
  const L = x2 - x1;
  for (let i = 0; i < 70; i++) {
    const h1 = hash(seed + i * 1.37), h2 = hash(seed + i * 2.71), h3 = hash(seed + i * 4.13);
    if (h3 > density) continue;
    const x = x1 + ((t * speed * (0.7 + 0.6 * h2) + h1 * L) % L);
    const row = Math.floor(h2 * rows) - Math.floor(rows / 2);
    const edge = Math.min(x - x1, x2 - x) / 40;
    if (hash(i + Math.floor(t * FPS_D)) > edge + 0.2) continue;
    ctx.fillStyle = color; ctx.fillRect(snap(x), snap(y) + row * CELL, CELL, CELL);
  }
}
// A flickering dither halo around (and above) a tile; stops at its bottom edge
// so the node's label underneath stays legible.
function halo(x, y, w, h, pad, color, level) {
  if (level <= 0) return;
  ctx.fillStyle = color;
  const f = Math.floor(tNow * FPS_D);
  for (let gy = snap(y - pad); gy < y + h + 4; gy += CELL)
    for (let gx = snap(x - pad); gx < x + w + pad; gx += CELL) {
      if (gx > x - 4 && gx < x + w - 3 && gy > y - 4 && gy < y + h - 3) continue;
      const dEdge = Math.max(x - gx, gx - (x + w), y - gy, gy - (y + h), 0) / pad;
      const l = level * (1 - dEdge) * (0.6 + 0.4 * hash(gx * 0.7 + gy * 1.3 + f));
      if (bayer(gx, gy) < l * 16) ctx.fillRect(gx, gy, CELL, CELL);
    }
}
function line(x1, x2, y, color, l, dash) {
  if (l <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; if (dash) ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(lerp(x1, x2, easeOut(l)), y); ctx.stroke(); ctx.restore();
}

// ---------- chrome: header, stage, captions, progress ----------
// Type is sized for where each format is seen. Landscape: the ~576 CSS px
// article embed shows the frame at roughly 45%, so 40px captions read as
// ~18px. Feed: a phone shows the 1080px frame at roughly 35%, so captions
// are 54px.

// Feed stage: the landscape scene area (y 90-540) scaled by 0.86 around the
// 64px left margin, so landscape x 64 stays at feed x 64, into y 360-747 of
// the 1080×1350 frame.
const STAGE = { margin: 64, sy: 90, sh: 450, s: 0.86, y: 360 };
function stage(fn) {
  if (!FEED) { fn(); return; }
  ctx.save();
  ctx.beginPath(); ctx.rect(0, STAGE.y, W, STAGE.sh * STAGE.s); ctx.clip();
  ctx.translate(STAGE.margin * (1 - STAGE.s), STAGE.y - STAGE.sy * STAGE.s); ctx.scale(STAGE.s, STAGE.s);
  fn(); ctx.restore();
}
function balancedWrap(g, text, maxW) {
  // Narrow the measure while the line count holds, so a multi-line block
  // never ends on a single orphaned word.
  let lines = wrap(g, text, maxW);
  for (let w = maxW - 20; lines.length > 1 && w > maxW / 2; w -= 20) {
    const tighter = wrap(g, text, w);
    if (tighter.length !== lines.length) break;
    lines = tighter;
  }
  return lines;
}
function chrome(title, scene, scenes, headline) {
  if (!FEED) {
    eyebrow(ctx, title, 64, 40, C.gray400, 16);
    for (let i = 0; i < scenes; i++) {
      ctx.fillStyle = i < scene ? C.p700 : i === scene ? C.p400 : C.zinc800;
      ctx.fillRect(1216 - (scenes - i) * 46 + 6, 668, 40, 5);
    }
    return;
  }
  eyebrow(ctx, title, 64, 96, C.gray400, 22);
  if (headline) {
    font(ctx, 600, 46); ctx.fillStyle = C.white; ctx.textAlign = "left"; ctx.textBaseline = "top";
    balancedWrap(ctx, headline, 952).forEach((l, i) => ctx.fillText(l, 64, 140 + i * 56));
  }
  font(ctx, 400, 22); ctx.fillStyle = C.gray400; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("brandonverzuu.com", 64, 1258);
  for (let i = 0; i < scenes; i++) {
    ctx.fillStyle = i < scene ? C.p700 : i === scene ? C.p400 : C.zinc800;
    ctx.fillRect(1016 - (scenes - i) * 60 + 8, 1268, 52, 6);
  }
}
// Caption block: "0N / 0M" eyebrow over balanced lines, dithered in and out
// as a whole. Landscape anchors it bottom-left; feed sets it under the stage.
function caption(text, scene, scenes, level, color) {
  if (level <= 0) return;
  const size = FEED ? 54 : 40, lh = FEED ? 64 : 48, eb = FEED ? 22 : 16;
  font(ctx, 600, size);
  const lines = balancedWrap(ctx, text, FEED ? 952 : 860);
  const top = FEED ? 880 : 632 - (lines.length - 1) * 48;
  const ebTop = top - (FEED ? 40 : 30);
  revealRect(level, 60, ebTop - 4, FEED ? 960 : 900, top + lines.length * lh - ebTop + 8, () => {
    eyebrow(ctx, `${String(scene + 1).padStart(2, "0")} / ${String(scenes).padStart(2, "0")}`, 64, ebTop, color, eb);
    font(ctx, 600, size); ctx.fillStyle = C.white; ctx.textAlign = "left"; ctx.textBaseline = "top";
    lines.forEach((l, i) => ctx.fillText(l, 64, top + i * lh));
  });
}
function clear() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.ground; ctx.fillRect(0, 0, W, H);
}

// ---------- data-driven stories ----------
// Most explainers are built from the same vocabulary: nodes, chips, cards,
// lines, streams, halos and a packet. defineStory() turns a scene list into
// window.STORY, so a story file is data plus captions. Elements are drawn in
// landscape coordinates (inside stage(); keep them within y 90-540) and in
// list order, so put halos and streams before the nodes they surround.
//
// Element fields shared by every type:
//   at     seconds after its scene starts to dither in (default 0.4)
//   span   number of scenes it stays on screen (default 1); it dithers out
//          0.6 s before the last of those scenes ends
// Types:
//   node   { n: {v, icon, label, sub}, x, y, compact, dissolveAt, dir }
//          x, y = tile centre; dissolveAt (seconds after its scene starts)
//          breaks it into terracotta particles — the one particle effect,
//          for a story beat that means something leaving
//   chip   { x, y, w, h, text, icon, v, mono, center, size, dissolveAt }
//   card   { x, y, w, h, title, icon, v, lines: [str | {text, color, mono}], mono, size, lh }
//   text   { x, y, text, size, color, weight, mono, w }
//   eyebrow { x, y, text, color }
//   line   { x1, x2, y, color, dash, arrow }  draws itself in over 0.6 s
//   stream { x1, x2, y, color, density, seed, rows }
//   halo   { around: [x, y, compact] } or { x, y, w, h }, pad, color, level
//   packet { x1, x2, y, color, dur }  a solid cell with a dithered trail
const MONO = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, 'DejaVu Sans Mono', monospace";
const TONE = { terra: C.terra, porc: C.p300, neutral: C.gray400, line: C.line, p400: C.p400, white: C.white, text: C.text };
const tone = (c, fallback) => (c ? TONE[c] || c : fallback);

function chipDraw(g, e) {
  const v = V[e.v || "porc"];
  rbox(g, 2, 2, e.w, e.h, e.r ?? 12, v);
  const size = e.size || (e.mono ? 18 : 20);
  g.font = `${e.mono ? 600 : 600} ${size}px ${e.mono ? MONO : SANS}`;
  g.fillStyle = tone(e.color, e.v === "porc" || !e.v ? "#e9f1f5" : C.text);
  g.textBaseline = "middle";
  if (e.icon) icon(g, e.icon, 2 + 18, 2 + e.h / 2 - 13, 26, v.ic);
  if (e.center && !e.icon) { g.textAlign = "center"; g.fillText(e.text, 2 + e.w / 2, 2 + e.h / 2 + 1); }
  else { g.textAlign = "left"; g.fillText(e.text, 2 + (e.icon ? 58 : 20), 2 + e.h / 2 + 1); }
}
function cardDraw(g, e) {
  const v = V[e.v || "neutral"];
  rbox(g, 2, 2, e.w, e.h, 16, v);
  const x = 2 + 24; let y = 2 + 22;
  if (e.icon) icon(g, e.icon, x, y - 2, 28, v.ic);
  if (e.title) {
    font(g, 600, 22); g.fillStyle = C.white; g.textAlign = "left"; g.textBaseline = "top";
    g.fillText(e.title, e.icon ? x + 40 : x, y + 2); y += 50;
  }
  (e.lines || []).forEach((l, i) => {
    const L = typeof l === "string" ? { text: l } : l, mono = L.mono ?? e.mono;
    g.font = `${mono ? 600 : 400} ${e.size || (mono ? 19 : 21)}px ${mono ? MONO : SANS}`;
    g.fillStyle = tone(L.color, C.text); g.textAlign = "left"; g.textBaseline = "top";
    g.fillText(L.text, x, y + i * (e.lh || 34));
  });
}
function arrowLine(x1, x2, y, color, p, dash, head) {
  if (p <= 0) return;
  const dir = Math.sign(x2 - x1) || 1, tip = lerp(x1, x2, easeOut(p));
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round";
  if (dash) ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(head ? tip - dir * 6 : tip, y); ctx.stroke();
  if (head) { ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(tip, y); ctx.lineTo(tip - dir * 10, y - 5); ctx.lineTo(tip - dir * 10, y + 5); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function packetAt(x1, x2, y, p, color) {
  for (let j = 8; j >= 0; j--) {
    const k = p - j * 0.025; if (k <= 0 || k >= 1) continue;
    const x = lerp(x1, x2, easeInOut(k));
    if (j === 0) { ctx.fillStyle = color; ctx.fillRect(snap(x - 10), snap(y - 10), 21, 21); }
    else ditherFill(x - 10, y - 10, 21, 21, color, 0.7 - j * 0.07);
  }
}
const elKey = (e) => e.key || JSON.stringify([e.type, e.n, e.x, e.y, e.w, e.h, e.text, e.title, e.lines, e.icon, e.v, e.mono, e.compact]);

function drawEl(e, t, s0, end) {
  const at = s0 + (e.at ?? 0.4);
  if (t < at - 0.01 && e.type !== "stream") return;
  const L = lvl(t, at, e.dur ?? 0.6, end - 0.6, 0.45);
  const dz = e.dissolveAt != null ? s0 + e.dissolveAt : null;
  const spr = (s, x, y) => {
    if (dz !== null && t >= dz) dissolve(s, x, y, clamp((t - dz) / 2.2), C.terra, e.dir || -1);
    else drawSprite(s, x, y, L);
  };
  switch (e.type) {
    case "node": {
      const s = (e.compact ? cnodeSprite : nodeSprite)(elKey(e), e.n);
      spr(s, e.x - s.w / 2, e.y - (e.compact ? TILE2 : TILE) / 2); break;
    }
    case "chip": spr(sprite(elKey(e), e.w + 4, e.h + 4, (g) => chipDraw(g, e)), e.x - 2, e.y - 2); break;
    case "card": spr(sprite(elKey(e), e.w + 4, e.h + 4, (g) => cardDraw(g, e)), e.x - 2, e.y - 2); break;
    case "text": {
      const size = e.size || 22, w = e.w || 900;
      const rx = e.align === "center" ? e.x - w / 2 : e.align === "right" ? e.x - w : e.x - 4;
      revealRect(L, rx, e.y - 4, w + 8, size + 14, () => {
        ctx.font = `${e.weight || 600} ${size}px ${e.mono ? MONO : SANS}`; ctx.fillStyle = tone(e.color, C.text);
        ctx.textAlign = e.align || "left"; ctx.textBaseline = "top"; ctx.fillText(e.text, e.x, e.y);
      }); break;
    }
    case "eyebrow": revealRect(L, e.x - 4, e.y - 4, 640, 26, () => eyebrow(ctx, e.text, e.x, e.y, tone(e.color, C.gray400), 16)); break;
    case "line": {
      const p = clamp((t - at) / (e.draw ?? 0.6));
      revealRect(L, Math.min(e.x1, e.x2) - 12, e.y - 10, Math.abs(e.x2 - e.x1) + 24, 20,
        () => arrowLine(e.x1, e.x2, e.y, tone(e.color, C.line), p, e.dash, e.arrow)); break;
    }
    case "stream": {
      const ramp = Math.min(clamp((t - at) / 0.8), 1 - clamp((t - (end - 0.6)) / 0.4));
      stream(e.x1, e.x2, e.y, t, tone(e.color, C.p300), (e.density ?? 0.7) * ramp, e.seed || 7, e.speed || 160, e.rows ?? 3); break;
    }
    case "halo": {
      let { x, y, w, h } = e;
      if (e.around) { const [cx, cy, compact] = e.around, k = compact ? TILE2 : TILE; x = cx - k / 2; y = cy - k / 2; w = h = k; }
      const ramp = clamp((t - at) / 0.8);
      halo(x, y, w, h, e.pad || (e.around && e.around[2] ? 32 : 56), tone(e.color, C.terra), Math.min(L, ramp * (e.level ?? 0.5))); break;
    }
    case "packet": {
      const p = (t - at) / (e.dur ?? 1.2);
      if (p > 0 && p < 1.3) packetAt(e.x1, e.x2, e.y, p, tone(e.color, C.p300)); break;
    }
  }
}

// The closing comparison: two rows of compact nodes, "before" on top in
// terracotta, "after" below in porcelain. Nodes: {icon, label, sub, v}; a
// node with v "terra" gets a flickering halo. 3 or 4 nodes per row.
function compareEls(before, after) {
  const els = [];
  const row = (r, y, ebY, ebColor, t0, isAfter) => {
    els.push({ type: "eyebrow", x: 64, y: ebY, text: r.label, color: ebColor, at: t0 });
    const n = r.nodes.length, xs = r.nodes.map((_, i) => 200 + i * (860 / (n - 1)));
    r.nodes.forEach((nd, i) => { if (nd.v === "terra") els.push({ type: "halo", around: [xs[i], y, true], at: t0 + 0.6 + i * 0.3, level: 0.4 }); });
    if (isAfter) els.push({ type: "stream", x1: xs[0] + 56, x2: xs[n - 1] - 56, y, color: "porc", density: 0.45, rows: 1, seed: 21, at: t0 + 1.4 });
    for (let i = 0; i < n - 1; i++) {
      const next = r.nodes[i + 1];
      els.push({ type: "line", x1: xs[i] + 52, x2: xs[i + 1] - 52, y, at: t0 + 0.7 + i * 0.3, arrow: true,
        color: isAfter ? "p400" : next.v === "terra" ? "terra" : "line", dash: !isAfter && next.v === "terra" });
    }
    r.nodes.forEach((nd, i) => els.push({ type: "node", compact: true, x: xs[i], y, at: t0 + 0.2 + i * 0.3, n: { v: nd.v || "neutral", icon: nd.icon, label: nd.label, sub: nd.sub } }));
  };
  row(before, 190, 104, C.terra, 0.3, false);
  row(after, 420, 336, C.p300, 2.0, true);
  return els;
}

function defineStory(def) {
  const SC = [0];
  def.scenes.forEach((s) => SC.push(SC[SC.length - 1] + s.dur));
  const N = def.scenes.length, T = SC[N];
  function render(t) {
    setTime(t); clear();
    let sc = 0; for (let i = N - 1; i >= 0; i--) if (t >= SC[i]) { sc = i; break; }
    const s = def.scenes[sc];
    chrome(def.title, sc, N, def.headline);
    caption(s.caption, sc, N, lvl(t, SC[sc] + 0.3, 0.5, SC[sc + 1] - 0.6, 0.45), s.tone === "porc" ? C.p300 : C.terra);
    stage(() => {
      def.scenes.forEach((sd, i) => sd.els.forEach((e) => {
        const end = SC[Math.min(N, i + (e.span || 1))];
        if (t >= SC[i] && t < end) drawEl(e, t, SC[i], end);
      }));
    });
  }
  window.STORY = { duration: T, poster: SC[N - 1] + (def.posterOffset ?? 5), end: T - 0.75, render };
}

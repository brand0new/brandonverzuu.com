// Zero-ticket integration: the explainer for
// content/articles/building-platforms-for-vendor-led-enterprises.md.
//
// Six scenes, one idea each. Terracotta carries the "before" (work held by
// people), porcelain the "after" (work held by the platform). The vendor
// breaking apart in scene 3 is the only particle effect; everything else
// enters and leaves through the standard dither reveal.
//
// Render with: npm run explainer:render -- zero-ticket

const SC = [0, 5, 10.5, 15, 21.5, 26, 33]; // scene starts; the last value is the loop length
const SCENES = 6;
const CAPTIONS = [
  "A vendor builds your integration.",
  "Every question they have becomes a ticket for your team.",
  "At go-live, the vendor leaves. Your team inherits what was built.",
  "Put the governance in a platform, not a slide deck.",
  "The next vendor gets answers from the platform. Zero tickets.",
  "Before: people carry the governance. After: the platform does.",
];

const CY = 300; // centre line of the single-row scenes
const N = {
  vendor: { v: "neutral", icon: "briefcase-fill", label: "Vendor" },
  estate1: { v: "neutral", icon: "building-tree-fill", label: "Your estate" },
  team: { v: "terra", icon: "users-fill", label: "Integration team" },
  estate3: { v: "terra", icon: "building-tree-fill", label: "Your estate", sub: "inherited as-is" },
  next: { v: "neutral", icon: "briefcase-fill", label: "Next vendor" },
  estate5: { v: "porc", icon: "building-tree-fill", label: "Your estate", sub: "principles intact" },
};
const CAPS = [
  ["search-fill", "Discovery"], ["book-text-fill", "Docs and diagrams"], ["package-box-fill", "SDK generation"],
  ["shield-check-fill", "Early validation"], ["layout-grid-fill", "One unified API"], ["exchange-a", "Canonical mapping"],
];
const CHIPS = CAPS.map(([ic, text], i) => ({ ic, text, x: 222 + (i % 3) * 284, y: 210 + Math.floor(i / 3) * 104, w: 268, h: 88 }));
const BIG = { x: 200, y: 120, w: 880, h: 330 }, SMALL = { x: 440, y: 232, w: 400, h: 136 };

function platform(g, r, k) { // k: 0 = big layout (title top-left), 1 = compact (title centred)
  g.beginPath(); g.roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 20);
  g.fillStyle = C.surface; g.fill(); g.strokeStyle = C.p400; g.lineWidth = 1.5; g.stroke();
  font(g, 600, lerp(30, 26, k));
  const label = "Integration platform", tw = g.measureText(label).width, isz = lerp(34, 30, k);
  const bx = lerp(r.x + 32, r.x + r.w / 2 - (tw + isz + 14) / 2, k), by = lerp(r.y + 28, r.y + r.h / 2 - isz / 2, k);
  icon(g, "stack-fill", bx, by, isz, C.p300);
  g.fillStyle = C.white; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(label, bx + isz + 14, by + isz / 2 + 1);
}
function chip(g, c) {
  rbox(g, c.x, c.y, c.w, c.h, 14, V.porc);
  icon(g, c.ic, c.x + 20, c.y + c.h / 2 - 15, 30, C.p300);
  font(g, 600, 20); g.fillStyle = "#e9f1f5"; g.textAlign = "left"; g.textBaseline = "middle";
  g.fillText(c.text, c.x + 64, c.y + c.h / 2 + 1);
}
const TICKET = 64, SMALLT = 44;
function ticket(g, cx, cy, size, isz) {
  rbox(g, cx - size / 2, cy - size / 2, size, size, size * 0.22, V.terra);
  icon(g, "message-question-mark-fill", cx - isz / 2, cy - isz / 2, isz, C.terra);
}

function render(t) {
  setTime(t); clear();
  let sc = 0; for (let i = SCENES - 1; i >= 0; i--) if (t >= SC[i]) { sc = i; break; }
  const S = (i) => SC[i], T = SC[SCENES];

  chrome("Zero-ticket integration", sc, SCENES);
  caption(CAPTIONS[sc], sc, SCENES, lvl(t, S(sc) + 0.3, 0.5, S(sc + 1) - 0.6, 0.45), sc >= 3 ? C.p300 : C.terra);

  // The vendor: one node that travels through scenes 1-3, then breaks apart.
  if (t < S(3)) {
    const vx = t < S(1) ? 340 : t < S(2) ? lerp(340, 300, easeInOut((t - S(1)) / 0.8)) : lerp(300, 440, easeInOut((t - S(2)) / 0.8));
    const vS = nodeSprite("vendor", N.vendor), vbx = vx - vS.w / 2, vby = CY - TILE / 2;
    const dz = S(2) + 1.4;
    if (t < dz) drawSprite(vS, vbx, vby, lvl(t, 0.3));
    else dissolve(vS, vbx, vby, clamp((t - dz) / 2.2), C.terra, -1);
  }

  // Scene 1: the vendor builds; work flows into the estate.
  if (t < S(1)) {
    const out = S(1) - 0.6;
    stream(420, 860, CY, t, C.text, Math.min(clamp((t - 1.4) / 0.8), 1 - clamp((t - out) / 0.4)) * 0.8, 3);
    putNode("estate1", N.estate1, 940, CY, lvl(t, 0.8, 0.6, out));
  }

  // Scene 2: questions fly over as tickets and pile up on the team.
  if (t >= S(1) && t < S(2)) {
    const u = t - S(1), tx = 980, vx = lerp(340, 300, easeInOut(u / 0.8));
    const tl = lvl(t, S(1) + 0.5, 0.6, S(2) - 0.6);
    const tk = sprite("ticket", TICKET + 4, TICKET + 4, (g) => ticket(g, (TICKET + 4) / 2, (TICKET + 4) / 2, TICKET, 36));
    let landed = 0, lastLand = -9;
    for (let i = 0; i < 6; i++) {
      const t0 = 1.3 + i * 0.5, k = (u - t0) / 0.85;
      if (k >= 1) { landed++; lastLand = t0 + 0.85; continue; }
      if (k <= 0) continue;
      const pos = (kk) => { const e = easeInOut(kk); return [lerp(vx + 72, tx - 72, e), CY - Math.sin(e * Math.PI) * 130]; };
      for (const [lag, d] of [[0.08, 0.13], [0.04, 0.22]]) { // two light dithered trail copies
        if (k - lag <= 0) continue;
        const [sx, sy] = pos(k - lag); ditherFill(sx - 28, sy - 28, 56, 56, C.terra, d);
      }
      const [x, y] = pos(k); ctx.drawImage(tk.cv, x - tk.w / 2, y - tk.h / 2);
    }
    if (tl > 0) {
      halo(tx - TILE / 2, CY - TILE / 2, TILE, TILE, 56, C.terra, Math.min(tl, 0.15 + landed * 0.09));
      const sq = u - lastLand >= 0 && u - lastLand < 0.12; // squash on impact
      ctx.save(); if (sq) { ctx.translate(tx, CY); ctx.scale(0.98, 0.99); ctx.translate(-tx, -CY); }
      putNode("team", N.team, tx, CY, tl); ctx.restore();
      ctx.fillStyle = C.terra; // the pile: one bar of cells per landed ticket
      for (let k = 0; k < landed; k++) {
        const by = snap(CY - TILE / 2 - 28 - k * 14);
        for (let gx = snap(tx - 42); gx < tx + 42; gx += CELL) if (bayer(gx, by) < tl * 16) ctx.fillRect(gx, by, CELL, CELL);
      }
    }
  }

  // Scene 3: the vendor leaves; the estate is left behind, flickering.
  if (t >= S(2) && t < S(3)) {
    const ex = 900, l = lvl(t, S(2) + 0.6, 0.6, S(3) - 0.6);
    halo(ex - TILE / 2, CY - TILE / 2, TILE, TILE, 64, C.terra, Math.min(l, clamp((t - S(2) - 2.4) / 1.0) * 0.6));
    putNode("estate3", N.estate3, ex, CY, l);
  }

  // Scenes 4-5: the platform appears, gains its capabilities, then compacts into the pipeline.
  if (t >= S(3) && t < S(5)) {
    const k = easeInOut((t - S(4)) / 0.9);
    const r = { x: lerp(BIG.x, SMALL.x, k), y: lerp(BIG.y, SMALL.y, k), w: lerp(BIG.w, SMALL.w, k), h: lerp(BIG.h, SMALL.h, k) };
    const pl = lvl(t, S(3) + 0.4, 0.8, S(5) - 0.6);
    if (t > S(4) + 0.9) stream(288, 992, CY, t, C.p400, Math.min(clamp((t - S(4) - 1.2) / 0.8), pl) * 0.8, 9, 170);
    revealRect(pl, r.x, r.y, r.w, r.h, () => platform(ctx, r, k));
    if (t < S(4) + 0.2) CHIPS.forEach((c, i) => {
      const cs = sprite("chip" + i, c.w + 4, c.h + 4, (g) => { g.translate(2, 2); chip(g, { ...c, x: 0, y: 0 }); });
      drawSprite(cs, c.x - 2, c.y - 2, lvl(t, S(3) + 1.7 + i * 0.4, 0.5, S(4) - 0.5, 0.4));
    });
  }

  // Scene 5: the next vendor goes straight through.
  if (t >= S(4) && t < S(5)) {
    const out = S(5) - 0.6, arrive = S(4) + 2.6;
    putNode("next", N.next, 220, CY, lvl(t, S(4) + 0.7, 0.6, out));
    const sq = t > arrive && t < arrive + 0.14;
    ctx.save(); if (sq) { ctx.translate(1060, CY); ctx.scale(0.98, 0.99); ctx.translate(-1060, -CY); }
    putNode("estate5", N.estate5, 1060, CY, lvl(t, S(4) + 0.9, 0.6, out)); ctx.restore();
    const pk = (t - (arrive - 1.2)) / 1.2; // the request: a solid packet with a dithered trail
    if (pk > 0 && pk < 1) {
      for (let j = 8; j >= 0; j--) {
        const kk = pk - j * 0.025; if (kk <= 0) continue;
        const x = lerp(292, 988, easeInOut(kk));
        if (j === 0) { ctx.fillStyle = C.p300; ctx.fillRect(snap(x - 10), snap(CY - 10), 21, 21); }
        else ditherFill(x - 10, CY - 10, 21, 21, C.p300, 0.7 - j * 0.07);
      }
    }
    const zS = sprite("zero", 320, 64, (g) => {
      icon(g, "inbox-check-fill", 0, 8, 48, C.p300);
      font(g, 600, 44); g.fillStyle = C.p300; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("0 tickets", 62, 33);
    });
    drawSprite(zS, 640 - 125, 420, lvl(t, arrive + 0.3, 0.6, out));
  }

  // Scene 6: before and after, side by side, held for comparison.
  if (t >= S(5)) {
    const s = S(5), out = T - 0.7, L = (at, d = 0.6) => lvl(t, s + at, d, out, 0.5);
    const yB = 190, yA = 420;
    revealRect(L(0.3), 64, 104, 600, 20, () => eyebrow(ctx, "Before · governance in a slide deck", 64, 104, C.terra, 16));
    line(248, 592, yB, C.line, L(1.0) > 0 ? clamp((t - s - 1.0) / 0.6) : 0);
    line(688, 1012, yB, C.terra, L(1.4) > 0 ? clamp((t - s - 1.4) / 0.6) : 0, true);
    halo(640 - TILE2 / 2, yB - TILE2 / 2, TILE2, TILE2, 35, C.terra, Math.min(L(0.9), 0.4));
    halo(1060 - TILE2 / 2, yB - TILE2 / 2, TILE2, TILE2, 28, C.terra, Math.min(L(1.3), 0.3));
    putCNode("cVendor", { v: "neutral", icon: "briefcase-fill", label: "Vendor" }, 200, yB, L(0.5));
    const st = sprite("tSmall", SMALLT + 4, SMALLT + 4, (g) => ticket(g, (SMALLT + 4) / 2, (SMALLT + 4) / 2, SMALLT, 24));
    [350, 420, 490].forEach((x, i) => drawSprite(st, x - st.w / 2, yB - st.h / 2, L(1.1 + i * 0.15, 0.4)));
    putCNode("cTeam", { v: "terra", icon: "users-fill", label: "Integration team", sub: "answers every ticket" }, 640, yB, L(0.8));
    putCNode("cEstateB", { v: "terra", icon: "building-tree-fill", label: "Your estate", sub: "drifts after go-live" }, 1060, yB, L(1.2));

    revealRect(L(2.0), 64, 336, 600, 20, () => eyebrow(ctx, "After · governance in the tooling", 64, 336, C.p300, 16));
    line(248, 430, yA, C.p400, L(2.7) > 0 ? clamp((t - s - 2.7) / 0.5) : 0);
    line(850, 1012, yA, C.p400, L(2.9) > 0 ? clamp((t - s - 2.9) / 0.5) : 0);
    stream(256, 1004, yA, t, C.p300, Math.min(clamp((t - s - 3.2) / 0.8), L(3.2)) * 0.5, 21, 150, 1);
    putCNode("cNext", { v: "neutral", icon: "briefcase-fill", label: "Next vendor" }, 200, yA, L(2.2));
    const r = { x: 430, y: yA - 56, w: 420, h: 112 };
    revealRect(L(2.4), r.x, r.y, r.w, r.h, () => {
      ctx.beginPath(); ctx.roundRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 16);
      ctx.fillStyle = C.surface; ctx.fill(); ctx.strokeStyle = C.p400; ctx.lineWidth = 1.5; ctx.stroke();
      font(ctx, 600, 22); const lbl = "Integration platform", tw = ctx.measureText(lbl).width, x0 = 640 - (tw + 36) / 2;
      icon(ctx, "stack-fill", x0, r.y + 18, 26, C.p300);
      ctx.fillStyle = C.white; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(lbl, x0 + 36, r.y + 32);
      CAPS.forEach(([ic], i) => icon(ctx, ic, 640 - 3 * 44 + i * 44 + 9, r.y + 64, 26, C.p300));
    });
    putCNode("cEstateA", { v: "porc", icon: "building-tree-fill", label: "Your estate", sub: "principles intact" }, 1060, yA, L(2.6));
  }
}

window.STORY = {
  duration: SC[SCENES],
  poster: 31.5, // the held before/after comparison
  render,
};

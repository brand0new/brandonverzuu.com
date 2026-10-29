// Noise to Signal: the browser side of the dithered visual language.
//
// Resolve (understanding) and Glitch (lock-on) from the design system's
// "Noise to signal" and "Motion language" sections. The Bayer matrix is the
// standard recursive construction, ported from scripts/lib/bayer-dither.mjs
// (B. E. Bayer, "An Optimum Method for Two-Level Rendition of Continuous-Tone
// Pictures", IEEE ICC 1973), normalised here to (v + .5) / 64.

export const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const DPR = Math.min(2, window.devicePixelRatio || 1);

// Resolve tokens: noise floor in columns across the frame, and the focus where signal locks in.
export const RESOLVE = { floor: 56, signalAt: 0.96 };
// Covers are 1200x630 renders of a 400x210 dither (pixel size 3), so that grid is their native signal.
export const COVER_GRID = [400, 210];
// Glitch tokens: five frames on the shared 14 fps clock, 357 ms.
export const GLITCH = { frames: 5, frameMs: 71 };

const B = (() => {
  let m = [[0]];
  for (let n = 1; n < 8; n *= 2) {
    const s = [];
    for (let y = 0; y < n * 2; y++) {
      s.push([]);
      for (let x = 0; x < n * 2; x++) {
        const q = (y < n ? 0 : 2) + (x < n ? 0 : 1);
        s[y].push(m[y % n][x % n] * 4 + [0, 2, 3, 1][q]);
      }
    }
    m = s;
  }
  return m.map((r) => r.map((v) => (v + 0.5) / 64));
})();

export function tok(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function hexRgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(c) {
  const a = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
export function isDark() {
  return lum(hexRgb(tok("--paper"))) < 0.2;
}

// Calls back whenever the effective theme changes: the toggle (data-theme) or the OS setting.
export function onTheme(cb) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", cb);
  new MutationObserver(cb).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

// ---- Resolve ---------------------------------------------------------------
// A source is the image sampled once at its native grid (a cover's dither grid, a photo's pixels),
// kept as luminance plus a summed-area table so any coarser grid can be box-averaged cheaply.
export function Source(img, nw, nh) {
  const c = document.createElement("canvas");
  c.width = nw;
  c.height = nh;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, nw, nh);
  const d = g.getImageData(0, 0, nw, nh).data;
  const L = new Float32Array(nw * nh);
  let lo = 1, hi = 0;
  for (let i = 0; i < nw * nh; i++) {
    const l = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
    L[i] = l;
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  const S = new Float64Array((nw + 1) * (nh + 1));
  for (let y = 0; y < nh; y++) {
    let row = 0;
    for (let x = 0; x < nw; x++) {
      row += L[y * nw + x];
      S[(y + 1) * (nw + 1) + x + 1] = S[y * (nw + 1) + x + 1] + row;
    }
  }
  return { w: nw, h: nh, S, lo, hi };
}

function boxAvg(src, x0, y0, x1, y1) {
  x0 = Math.max(0, Math.min(src.w - 1, x0 | 0));
  y0 = Math.max(0, Math.min(src.h - 1, y0 | 0));
  x1 = Math.max(x0 + 1, Math.min(src.w, Math.round(x1)));
  y1 = Math.max(y0 + 1, Math.min(src.h, Math.round(y1)));
  const W = src.w + 1, S = src.S;
  return (S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
}

const scratch = document.createElement("canvas");
const sctx = scratch.getContext("2d");

// p: 0 = noise floor, 1 = signal. Columns grow geometrically, so every step of scroll gains the same
// share of detail. At signalAt the source's own grid is drawn dot for dot. Sets canvas._cols and
// canvas._native, and returns the column count drawn, or -1 when nothing changed.
export function resolve(canvas, src, p, o) {
  const W = canvas.width, H = canvas.height;
  let sw = src.w, sh = src.h;
  if (sw / sh > W / H) sw = (sh * W) / H;
  else sh = (sw * H) / W;
  const signal = p >= RESOLVE.signalAt;
  let gw, gh, cell = 0, key;
  if (signal) {
    sw = Math.round(sw);
    sh = Math.round(sh);
    gw = sw;
    gh = sh;
    key = "s";
  } else {
    const c0 = Math.min(RESOLVE.floor, sw);
    const cols = c0 * Math.pow(sw / c0, p / RESOLVE.signalAt);
    cell = Math.max(1, Math.round(W / cols));
    gw = Math.ceil(W / cell);
    gh = Math.ceil(H / cell);
    key = cell;
  }
  let sx = (src.w - sw) / 2, sy = (src.h - sh) / 2;
  if (signal) {
    sx = Math.round(sx);
    sy = Math.round(sy);
  }
  if (canvas._key === key && !o.force) return -1;
  canvas._key = key;
  const on = hexRgb(o.on), off = hexRgb(o.off);
  const img = sctx.createImageData(gw, gh), px = img.data;
  const span = Math.max(0.001, src.hi - src.lo);
  const ux = signal ? 1 : (sw * cell) / W, uy = signal ? 1 : (sh * cell) / H;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const v = o.tone((boxAvg(src, sx + x * ux, sy + y * uy, sx + (x + 1) * ux, sy + (y + 1) * uy) - src.lo) / span);
      const c = v > B[y & 7][x & 7] ? on : off, i = (y * gw + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
  scratch.width = gw;
  scratch.height = gh;
  sctx.putImageData(img, 0, 0);
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(scratch, 0, 0, gw, gh, 0, 0, signal ? W : gw * cell, signal ? H : gh * cell);
  canvas._cols = Math.round(signal ? sw : W / cell);
  canvas._native = Math.round(sw);
  return canvas._cols;
}

// Integer device-pixel canvas matching the element's box, DPR capped at 2.
export function sizeCanvas(cv, el) {
  const w = Math.max(1, Math.round(el.clientWidth * DPR)), h = Math.max(1, Math.round(el.clientHeight * DPR));
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
    cv._key = null;
  }
}

export function loadImage(url) {
  return new Promise((ok, fail) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => ok(im);
    im.onerror = fail;
    im.src = url;
  });
}

// Tone curves. Covers: the terracotta dots are the bright end of a dark cover and the dark end of a
// light one. Photos: dots carry light on dark paper and shadow on light paper, with extra contrast.
export const coverTone = (dark) => (v) => (dark ? v : 1 - v);
export const photoTone = (dark) => (l) => {
  l = Math.min(1, Math.max(0, (l - 0.5) * 1.3 + 0.5));
  return dark ? l : 1 - l;
};

// ---- Glitch: the lock-on ----------------------------------------------------
export function glitch(el) {
  if (reduce || !el) return;
  el.classList.remove("glitch");
  void el.offsetWidth;
  el.classList.add("glitch");
  clearTimeout(el._gt);
  el._gt = setTimeout(() => el.classList.remove("glitch"), GLITCH.frames * GLITCH.frameMs + GLITCH.frameMs);
}

// Chips decode: binary noise resolves left to right into the final words, a fifth per frame.
export function decode(el, text) {
  clearTimeout(el._dt);
  if (reduce) {
    el.textContent = text;
    el._decoding = false;
    return;
  }
  let k = 0;
  el._decoding = true;
  (function frame() {
    k++;
    const shown = Math.ceil((text.length * k) / GLITCH.frames);
    el.textContent = text.slice(0, shown) + text.slice(shown).replace(/[^ ·]/g, () => (Math.random() < 0.5 ? "0" : "1"));
    if (k < GLITCH.frames) el._dt = setTimeout(frame, GLITCH.frameMs);
    else {
      el.textContent = text;
      el._decoding = false;
    }
  })();
}

// A readout that may lock to signal: plain updates while noisy, a glitch and decode the moment it locks.
export function setReadout(el, text, sig) {
  const was = !!el._sig;
  el._sig = sig;
  el.classList.toggle("chip-signal", sig);
  if (sig && !was) {
    glitch(el);
    decode(el, text);
  } else if (!el._decoding) el.textContent = text;
}

// Highlights and drops lock on when fully in view, and re-arm once they leave it.
export function observeLockOn(els) {
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (e.intersectionRatio >= 0.99 && !e.target._seen) {
          e.target._seen = true;
          glitch(e.target);
        } else if (!e.isIntersecting) e.target._seen = false;
      }
    },
    { threshold: [0, 1] },
  );
  els.forEach((el) => io.observe(el));
}

// Bayer ordered dithering.
//
// Textbook technique — B. E. Bayer, "An Optimum Method for Two-Level
// Rendition of Continuous-Tone Pictures", IEEE ICC 1973 — not sourced from
// any particular codebase. Unlike Zhou-Fang's error diffusion, ordered
// dithering compares each pixel against a fixed per-cell threshold from a
// small repeating matrix: no error carries between pixels, which trades
// Zhou-Fang's organic, artifact-free gradients for a crisp, regular grid
// pattern — a deliberate retro/"digital" look rather than a smoother one.
//
// The matrix is built with the standard recursive construction rather than
// a hardcoded table, so any power-of-2 size works:
//   M(1) = [0]
//   M(2n) = [ 4*M(n)    4*M(n)+2 ]
//           [ 4*M(n)+3  4*M(n)+1 ]
// M(4) built this way reproduces the well-known canonical 4x4 Bayer matrix
// {0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5}.

function buildBayerMatrix(size) {
  if (size < 1 || (size & (size - 1)) !== 0) {
    throw new Error(`Bayer matrix size must be a power of 2, got ${size}`);
  }
  let matrix = [[0]];
  let n = 1;
  while (n < size) {
    const next = [];
    for (let y = 0; y < n; y++) {
      const rowTop = [];
      const rowBottom = [];
      for (let x = 0; x < n; x++) {
        const m = matrix[y][x];
        rowTop.push(4 * m, 4 * m + 2);
        rowBottom.push(4 * m + 3, 4 * m + 1);
      }
      next.push(rowTop, rowBottom);
    }
    matrix = next;
    n *= 2;
  }
  return matrix;
}

/**
 * @param {Float64Array|number[]} luminance - row-major linear-light
 *   luminance in [0, 1] (see color.mjs's toLinearLuminance).
 * @param {number} width
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.matrixSize=4] - must be a power of 2.
 * @returns {Uint8Array} one byte per pixel, 1 = "on", 0 = "off".
 */
export function bayerDither(luminance, width, height, options = {}) {
  const { matrixSize = 4 } = options;
  const matrix = buildBayerMatrix(matrixSize);
  const levels = matrixSize * matrixSize;
  const out = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const row = matrix[y % matrixSize];
    for (let x = 0; x < width; x++) {
      const threshold = (row[x % matrixSize] + 0.5) / levels;
      out[y * width + x] = luminance[y * width + x] >= threshold ? 1 : 0;
    }
  }
  return out;
}

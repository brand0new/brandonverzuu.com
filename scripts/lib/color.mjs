// Shared color-space helpers used by every dither mode.

// sRGB -> linear-light conversion, then Rec. 709 relative luminance.
// Dithering against linear-light values (rather than gamma-encoded sRGB
// bytes directly) avoids the midtone bias error diffusion and ordered
// dithering are both prone to otherwise — a very light pixel and a very
// dark one shouldn't both look "wrong" by the same visual amount when a
// naive gamma-encoded threshold is used.
function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {Buffer|Uint8Array} rgba - interleaved RGB(A), 8-bit/channel.
 * @param {number} pixelCount
 * @param {number} channels - 3 or 4.
 * @returns {Float64Array} row-major linear-light luminance in [0, 1].
 */
export function toLinearLuminance(rgba, pixelCount, channels) {
  const out = new Float64Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * channels;
    const r = srgbToLinear(rgba[o]);
    const g = srgbToLinear(rgba[o + 1]);
    const b = srgbToLinear(rgba[o + 2]);
    out[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return out;
}

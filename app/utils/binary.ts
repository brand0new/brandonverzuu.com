// Converts a short keyword into a per-character grid of binary digits for
// App/TopicBinaryIcon.vue's "top to bottom" layout: each character becomes
// one column, and that character's 8 bits (ASCII code point zero-padded to
// 8 bits, e.g. "A" -> 01000001) stack vertically within it, top bit first.
// Used to render each /topics cluster's icon as a literal binary encoding
// of a keyword that identifies it ("API", "AI", "BTC"), rather than a
// generic Iconify glyph — ties the icon into the site's existing
// dither/binary visual language instead of an arbitrary unrelated
// pictogram.
export function toBinaryColumns(keyword: string): string[][] {
  return keyword
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0").split(""));
}


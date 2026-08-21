// Converts a short keyword into rows of 8-bit binary — one row per
// character, using the character's ASCII code point zero-padded to 8 bits
// (e.g. "A" -> 01000001). Used by App/TopicBinaryIcon.vue to render each
// /topics cluster's icon as a literal binary encoding of a keyword that
// identifies it ("API", "AI", "BTC"), rather than a generic Iconify glyph —
// ties the icon into the site's existing dither/binary visual language
// instead of an arbitrary unrelated pictogram.
export function toBinaryRows(keyword: string): string[] {
  return keyword
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"));
}

// Fails the build when a text-carrying colour pair in scripts/lib/tokens.mjs drops below
// WCAG AA in either theme. Runs first in `npm run generate`, so a palette change can't
// reach master without passing it.
import { themes, pairs, contrast } from "./lib/tokens.mjs";

let failed = 0;
for (const [name, t] of Object.entries(themes)) {
  for (const p of pairs) {
    const r = contrast(t[p.fg], t[p.bg]);
    const ok = r >= p.min;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(5)} ${`${p.fg} on ${p.bg}`.padEnd(24)} ${r.toFixed(2)}:1 (min ${p.min}) · ${p.use}`);
  }
}
if (failed) {
  console.error(`\n${failed} colour pair(s) below WCAG AA. Fix them in scripts/lib/tokens.mjs.`);
  process.exit(1);
}

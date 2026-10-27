---
name: fingerprint-scrub
description: Run the deterministic fingerprint scrub (scripts/scrub-fingerprint.mjs) over an article draft and resolve what it reports. Use on any article drafted or heavily edited by a model, after the voice self-critique and before frontmatter is final. Agent-agnostic.
---

# Fingerprint scrub

A non-LLM pass that measures a draft against the corpus norms in
`skills/note-to-article/style-guide.md` §1 and the anti-pattern list in §9. It catches
what reading tends to miss (sentence rhythm, punctuation rate, filler phrases) and
works the same whichever model or provider wrote the draft.

It's a smell detector calibrated on Brandon's published articles, not a gate.
`npm run generate` doesn't run it and it never blocks a PR.

## 1. Apply the safe fixes

```
npm run scrub:fingerprint -- --file content/articles/<slug>.md --fix
```

`--fix` only applies the fixable tier in `scripts/lib/fingerprint-patterns.mjs`:
chatbot artifacts ("I hope this helps!") and filler substitutions ("in order to" →
"to"). These preserve meaning by construction.

## 2. Read the report

```
npm run scrub:fingerprint -- --file content/articles/<slug>.md
```

Add `--json` if you want to process the findings programmatically. It reports two
kinds of finding, with line numbers:

- **Smells**: measured against the §1 norms, such as sentence length, paragraph
  shape, em-dash rate, generic headings and bullet-list endings.
- **Flagged phrases**: wording from the §9 list ("delve", "crucial", "serves as a").

## 3. Judge each one by hand

Neither tier is auto-applied, because cutting the wrong clause can change meaning.
For each finding, read the sentence in context and edit it or leave it.

- A single flagged word isn't automatically wrong: the corpus uses a few of them. A
  cluster in one draft is the signal.
- Don't rewrite something that genuinely reads right just to clear the report.
- Don't skip the pass because the corpus itself isn't perfectly uniform.

Exit code 1 only means findings remain. Once you've judged every one, you're done.

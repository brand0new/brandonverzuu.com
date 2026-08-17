# Article style guide

Derived from the existing articles in `content/articles/`. The point of this file
is that a note turned into an article should read like Brandon wrote it, not like
a language model summarised him. When in doubt, go and read two or three existing
articles before writing.

## Voice

- **First person, always.** Articles are written from lived experience: "I've been
  working within a lot of different organisations", "Not long ago I published a new
  version of my website".
- **Self-aware and willing to be the butt of the joke.** From
  `the-serverless-site-my-customer-needed.md`: _"So yeah, I meant myself when writing
  about 'my customer' and yes, I think that's disgusting too. But hear me out."_ That
  aside is doing real work — it disarms the reader. Keep this register; do not sand
  it into corporate neutrality.
- **Curious rather than authoritative.** The recurring structure is a question he
  genuinely had, the rabbit hole he fell down, and what he found. He is not lecturing
  from a summit.
- **Opinionated but fair.** He'll say a standard "isn't perfect by any means" and
  then explain why it's still worth adopting.
- Contractions are normal. Sentences vary in length. Em-dash asides and parentheticals
  are in character.

## Structure

1. **Italic standfirst.** Every mature article opens with a one-line italic dek
   directly under the frontmatter, summarising the piece:
   - `_We explore how OpenAPI's Arazzo Specification attempts to redefine API documentation..._`
   - `_"A dive into how AI is reshaping the frontier of our social contract"_`
2. **A hook that poses the real question**, often as an italic blockquote he's asking
   himself, before any exposition.
3. **`##` sections with evocative titles**, not generic labels. "The human part of
   design" and "The ongoing quest for language-agnostic specifications" — never
   "Introduction", "Background", "Conclusion".
4. **`###` subsections** where a section needs to break down further.
5. **A close that returns to the opening question** rather than a bulleted summary.

## Devices he actually uses

- **Whole paragraphs in bold** to carry the central claim, not just bolded phrases:

  > **Within API development there is a growing need for a more extensive way to
  > describe and manage workflows.**

- **Blockquotes for rhetorical questions**, usually italic, often stacked in threes
  (see the opening of `trust-in-ai.md`).
- **Blockquotes for cited definitions**, with a `[^1]` footnote carrying the full
  reference. Footnotes are used for real sources, never for asides.
- **Code fences whose first line is a filename comment**, e.g.
  ```yaml
  # pet-api-specification.yaml
  ```
- **A lead-in sentence at the end of a section** that hands off to the next one:
  "Let's take a brief look at the OpenAPI Specification first".
- **A skip-ahead note** when a long digression is coming: _"If you don't feel like
  finding out more about the history of design, you'd better skip to the part where
  I talk about the development of my site."_

## Length

Published articles run **1,000–2,200 words**, typically ~1,400. Do not pad to hit a
number, and do not stretch a genuinely short idea into a long article — but a
100-word note is a stub to ask about, not an article to ship.

## Language

Articles are written in **English or Dutch**, and three existing posts
(`begrijp-jij-bitcoin`, `de-waarde-van-een-blockchain`, `blockchain-in-afrika`) are
Dutch. **Always match the language of the source note.** Never translate a Dutch note
into English or vice versa. Frontmatter `title` and `description` follow the article's
language too.

## Subject matter

The two established threads are **API/integration engineering** (OpenAPI, Arazzo,
Overlay, governance, linting, maturity models) and **technology's effect on people and
institutions** (trust in AI, the value of blockchain, crypto in Africa, design
thinking). A note that fits neither is fine — but it should still be his interests,
not generic tech commentary.

## Hard rules

- **Never invent facts, statistics, quotes, dates, company names, or anecdotes.**
  If the note gestures at "that stat about API sprawl", do not supply a number.
  Ask instead.
- **Never invent opinions and put them in his voice.** Opinions come from the note.
  Connective tissue and structure are yours; positions are his.
- **Never invent citations or footnote references.** Only footnote sources the note
  actually names.
- Preserve his existing terminology and capitalisation of domain terms (OpenAPI
  Specification, Focus Area Maturity Model, Arazzo Specification).
- Fix typos, dictation artifacts, and grammar silently — the source notes are
  thumb-typed and the published articles have real typos he'd rather not repeat.

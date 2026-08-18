# Capturing articles from an iPhone

Write a note on your phone, tap share, and get back a pull request with a drafted
article. This document is the one-time setup.

```
Apple Notes ──share──> Shortcut ──POST──> GitHub issue (draft-article)
                                                │
                                     scheduled Claude session
                                                │
                              ┌─────────────────┴─────────────────┐
                         note is thin                      note is enough
                              │                                   │
                    questions on the issue              PR on claude/article-<slug>
                    (needs-input label)                           │
                              │                          review in GitHub mobile
                        you reply ──────────────────────> merge ──> Cloudflare builds
```

Nothing goes live without you merging a PR. That is the only publish gate, and it's
deliberate.

## 1. Create the labels

In the repo, create three labels (Issues → Labels → New label):

| Label | Meaning |
| --- | --- |
| `draft-article` | Unprocessed note sitting in the inbox |
| `needs-input` | Claude asked questions and is waiting on you |
| `article-drafted` | A PR exists for this note |

`draft-article` is also the security boundary: applying a label needs write access to
the repo, so a labeled issue is provably one you created. The skill ignores anything
unlabeled.

## 2. Create a fine-grained PAT

github.com → Settings → Developer settings → Personal access tokens → Fine-grained
tokens → Generate new token.

- **Repository access:** Only select repositories → `brand0new/brandonverzuu.com`
- **Permissions:** Issues → **Read and write**. Nothing else. (Metadata: Read is
  added automatically.)
- **Expiration:** set a real one and diarise the renewal.

This token can only file issues on one repo. It cannot push code, read other repos,
or touch your account — which is what you want for a credential living in a Shortcut
that syncs through iCloud.

Copy it now; GitHub won't show it again.

## 3. Build the Shortcut

Shortcuts app → **+** → name it **Draft article**.

First, tap the shortcut's ⓘ (Details) and turn on:

- **Show in Share Sheet**
- **Accepted Types** → uncheck everything except **Text**

Then add these actions in order:

1. **Receive** — should already read *"Receive Text input from Share Sheet"*.
   Set **"If there's no input"** to **Ask For Text**, so the shortcut also works when
   run from the Home Screen or Siri.

2. **Split Text** — Input: *Shortcut Input*, Separator: **New Lines**.

3. **Get Item from List** — Get: **First Item** from *Split Text*.
   This becomes the issue title, so make the first line of your note a title.

4. **Get Contents of URL** —
   - **URL:** `https://api.github.com/repos/brand0new/brandonverzuu.com/issues`
   - **Method:** `POST`
   - **Headers:**
     | Key | Value |
     | --- | --- |
     | `Authorization` | `Bearer YOUR_TOKEN_HERE` |
     | `Accept` | `application/vnd.github+json` |
     | `X-GitHub-Api-Version` | `2022-11-28` |
   - **Request Body:** `JSON`
     | Key | Type | Value |
     | --- | --- | --- |
     | `title` | Text | *Item from List* (step 3) |
     | `body` | Text | *Shortcut Input* |
     | `labels` | Array → Text | `draft-article` |

5. **Get Dictionary Value** — Get **Value** for key `html_url` in *Contents of URL*.

6. **Show Notification** — Title: `Note captured`, Body: *Dictionary Value*.
   (Or use **Open URLs** if you'd rather jump straight to the issue.)

### Using it

Open a note in Notes → **Share** → **Draft article**. First line becomes the title,
the rest is the article source.

Worth adding once it works: a Home Screen icon, and "Hey Siri, draft article" for
dictating one while driving. Dictation artifacts are fine — the skill cleans them up.

## 4. Schedule the processing session

A Claude Code Routine wakes on a schedule, checks for issues labeled `draft-article`,
and runs the `note-to-article` skill on anything it finds. If the inbox is empty it
does nothing and goes back to sleep.

Twice a day is plenty for essays; there's no value in a tighter loop.

If you'd rather have it instant, the alternative is a GitHub Action on the
`issues.labeled` event running the Claude Code Action — that needs an
`ANTHROPIC_API_KEY` repo secret and bills separately from your subscription.

## What Claude does with a note

Defined in `.claude/skills/note-to-article/SKILL.md`, with the voice rules in
`.claude/article-style.md`. In short:

- **Ghostwriter.** It takes the seed and writes the whole article in your voice —
  a 200-word note becoming a 1,300-word piece is the expected outcome, not overreach.
  The style guide is derived from all eleven of your articles and carries measured
  targets: 17 words per sentence, ~29 per paragraph with half of them single-sentence,
  five `##` sections, your opening roadmap line, the split theory-versus-reality
  verdict, and a list of the LLM tells to avoid.
- **The line is facts, not length.** Structure, argument development, everyday
  analogies, and explicitly hypothetical examples are Claude's to write. Statistics,
  quotes, citations, positions you haven't taken, and anything *you personally did* —
  an engagement, a customer, a tool you built — are never invented.
- **Missing facts get questions, not guesses.** If the note points at a number or an
  anecdote it doesn't contain, Claude comments with three to five specific questions
  and says which sections it can already write. Answer from the GitHub app and it
  picks up where it left off.
- **Every PR says what came from where.** The body lists the argument moves,
  analogies, and examples Claude added, so you can see which claims are yours and
  which are craft before you merge.

## Rotating or revoking the token

Revoke on GitHub, generate a new one, edit the `Authorization` header in the
Shortcut. Nothing else references it.

# Capturing articles from an iPhone

Write a note on your phone, tap share, and get back a pull request with a drafted
article. This document is the one-time setup.

```
Apple Notes ──share──> Shortcut ──POST──> GitHub issue (draft-article)
                                                │
                                       scheduled agent run
                                                │
                              ┌─────────────────┴─────────────────┐
                         note is thin                      note is enough
                              │                                   │
                    questions on the issue              PR opened, checks run
                    (needs-input label)                           │
                              │                          checks pass ──> agent merges
                        you reply ──────────────────────> PR opened ──> checks pass
```

The only manual step is answering questions on the issue when a note is too thin to
write from. Once the facts are in, the agent takes the article all the way to a
merged PR itself.

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

## 2. Create a token for the agent

The scheduled agent needs write access to this repo — it files no issues itself, but
it comments on them, pushes branches, opens PRs, and merges them once checks pass.
That's broader than the Shortcut's PAT needs to be, so keep them separate:

- **Shortcut token** (step-by-step below): fine-grained, Issues **read/write** only,
  scoped to this one repo. It only ever creates an issue.
- **Agent token**: needs `repo` scope (or a fine-grained equivalent with
  Contents/Pull requests/Issues read-write on this repo) since it pushes commits,
  opens PRs, and merges them. This is whatever credential the onboarded agent already
  authenticates with — see `AGENTS.md` at the repo root for the onboarding step that
  wires this up.

### The Shortcut's own token

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

## 4. The scheduled run

Scheduling isn't done by hand per-agent: it's part of onboarding. `AGENTS.md` at the
repo root instructs any newly onboarded coding agent to set up its own recurring job
against this repo — check for issues labeled `draft-article`, run the
`note-to-article` procedure on anything it finds, do nothing if the inbox is empty.

Twice a day is plenty for essays; there's no value in a tighter loop.

## What the agent does with a note

Defined in `skills/note-to-article/SKILL.md`, with the voice rules in
`skills/note-to-article/style-guide.md`. In short:

- **Ghostwriter.** It takes the seed and writes the whole article in your voice —
  a 200-word note becoming a 1,300-word piece is the expected outcome, not overreach.
  The style guide is derived from all eleven of your articles and carries measured
  targets: 17 words per sentence, ~29 per paragraph with half of them single-sentence,
  five `##` sections, your opening roadmap line, the split theory-versus-reality
  verdict, and a list of the LLM tells to avoid.
- **The line is facts, not length.** Structure, argument development, everyday
  analogies, and explicitly hypothetical examples are the agent's to write. Statistics,
  quotes, citations, positions you haven't taken, and anything *you personally did* —
  an engagement, a customer, a tool you built — are never invented.
- **Missing facts get questions, not guesses.** If the note points at a number or an
  anecdote it doesn't contain, the agent comments on the issue with three to five
  specific questions and says which sections it can already write. Answer from the
  GitHub app and it picks up where it left off — this is the only place questions
  get asked.
- **The agent merges its own PR.** There is no manual review gate. Once
  `npm run generate` passes locally and the repo's required checks pass on the PR,
  the agent merges it and comments the merged link back on the issue. The "What I
  added" list in the PR body is what makes the change auditable after the fact —
  read it there if you want to see which claims are yours and which are craft.

## Rotating or revoking a token

Shortcut token: revoke on GitHub, generate a new one, edit the `Authorization`
header in the Shortcut. Nothing else references it.

Agent token: rotate through whatever auth flow the agent used during onboarding
(see `AGENTS.md`). Revoking it pauses the scheduled run until it's replaced.

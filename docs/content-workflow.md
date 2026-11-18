# The content workflow

Write a note on your phone, tap share, answer one comment, and get back a published
article and a post to share. A link or a project goes the same way, without the
comment. This document is how the pieces fit together and the one-time setup. The
procedures themselves are in `skills/`, starting at `skills/content-inbox/`.

```
Apple Notes ──share──> Shortcut ──POST──> GitHub issue (draft-article)
                                                │
                              label starts .github/workflows/content-inbox.yml
                                                │
                                  RUN 1   claim, read the note
                                          outline + questions on the issue
                                          (needs-input)
                                                │
                                you reply on the issue ("go", answers, changes)
                                                │
                                  RUN 2   research ─> draft ─> scrub ─> fact-check
                                          cover ─> explainer (technical articles)
                                          PR ─> generate check ─> merge = publish
                                          LinkedIn draft + link on the issue
                                          (published, issue closed)
```

A `draft-bookmark` or `draft-project` issue takes one run: there's no outline to
agree on, so the agent adds the entry, merges and closes the issue. It only stops to
ask when something is missing, such as a project's thumbnail.

Your part is the note, one reply, and posting the LinkedIn draft yourself.

## What changed from the first version

- **An outline before a draft.** Every article now starts with a proposed angle and
  section list that you answer on the issue. Before, the agent wrote the whole piece
  straight from the note and only asked when facts were missing.
- **Research and a fact-check.** The agent may now look facts up, from primary sources
  it actually opened, and every claim and link is checked before the PR. Before, it
  could only use what the note contained.
- **Distribution.** The run ends with a LinkedIn draft on the issue, not at the merge.
- **A trigger in the repo.** A GitHub Action starts the agent. Before, running the
  procedure was left to whichever agent was pointed at it.
- **More than articles.** Bookmarks and projects come in through the same inbox, and
  technical articles get an explainer as a standard step.
- **Labels renamed.** `article-in-progress` is now `in-progress` and `article-drafted`
  is now `published`, since they're shared by all three kinds of content.

## One-time setup

Nothing below is done by merging this repo's files. Until all four are in place, the
workflow file is inert: a run either doesn't start or fails at the first step.

### 1. Create the labels

Issues → Labels → New label, or with the CLI:

```
gh label create draft-article  --description "Inbox: a note to turn into an article"
gh label create draft-bookmark --description "Inbox: a link for /bookmarks"
gh label create draft-project  --description "Inbox: a project for /projects"
gh label create needs-input    --description "The agent asked something and is waiting for a reply"
gh label create in-progress    --description "A run owns this issue; others skip it"
gh label create published      --description "Merged and live"
```

| Label | Meaning |
| --- | --- |
| `draft-article`, `draft-bookmark`, `draft-project` | in the inbox |
| `needs-input` | the agent asked something and is waiting on you |
| `in-progress` | a run has claimed the issue; every other run skips it |
| `published` | the content is merged and the issue is closed |

The security boundary is the label **plus** the issue author. The workflow and the
skill both only act on inbox issues opened by `brand0new`, because anyone with triage
access could apply a label to someone else's issue. Issues filed by the Shortcut are
opened by the token's owner, so they pass. On the thread, only your own comments
restart a run.

### 2. Install the Claude GitHub app

Install <https://github.com/apps/claude> on this repository. The workflow passes no
`github_token`, so the agent acts as that app: it comments, pushes the branch, opens
the PR and merges it.

That choice matters. A pull request opened with a workflow's default `GITHUB_TOKEN`
doesn't trigger other workflows, so `build.yml` would never run on it and the required
`generate` check would never report. As the app, the PR behaves like anyone else's.

### 3. Add the Claude credential

Run `claude setup-token` locally and store the result as the repository secret
`CLAUDE_CODE_OAUTH_TOKEN` (Settings → Secrets and variables → Actions). Runs then use
your Claude subscription. To bill the API instead, store a key as `ANTHROPIC_API_KEY`
and change the workflow's `claude_code_oauth_token` line to
`anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`.

Running `/install-github-app` inside Claude Code does steps 2 and 3 for you. Decline
the workflow files it offers: this repo already has its own.

### 4. Build the Shortcuts

One Shortcut per kind of content. They differ only in the label and in what they
accept.

**The Shortcut's token.** github.com → Settings → Developer settings → Personal access
tokens → Fine-grained tokens → Generate new token.

- **Repository access:** Only select repositories → `brand0new/brandonverzuu.com`
- **Permissions:** Issues → **Read and write**. Nothing else. (Metadata: Read is
  added automatically.)
- **Expiration:** set a real one and diarise the renewal.

This token can only file issues on one repo. It cannot push code, read other repos,
or touch your account, which is what you want for a credential living in a Shortcut
that syncs through iCloud. Copy it now; GitHub won't show it again.

**Draft article.** Shortcuts app → **+** → name it **Draft article**. Tap the
shortcut's ⓘ (Details) and turn on **Show in Share Sheet**, with **Accepted Types**
set to **Text** only. Then add these actions in order:

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

**Save bookmark.** Duplicate the Shortcut. Set **Accepted Types** to **URLs** and
**Text**, and change the label to `draft-bookmark`. Share a page from Safari and the
link becomes the issue. To write the label yourself, put a line of text under the
link in the issue body; without one the agent describes the page factually.

**Draft project.** Duplicate it again with the label `draft-project`. A project needs
a name, a URL, a one-sentence description, a status, whether it's open source and a
thumbnail image, so it's usually easier to open the issue in the GitHub app, where
you can attach the image. Whatever is missing, the agent asks for.

### Using it

Open a note in Notes → **Share** → **Draft article**. First line becomes the title,
the rest is the article source. A few minutes later the outline is on the issue:
answer it from the GitHub app.

Worth adding once it works: a Home Screen icon, and "Hey Siri, draft article" for
dictating one while driving. Dictation artifacts are fine; the skill cleans them up.

## What the agent does with a note

Defined in `skills/note-to-article/SKILL.md`, with the voice rules in
`skills/note-to-article/style-guide.md`. In short:

- **Outline first.** You get a title, the angle in one sentence, the sections and at
  most five questions. Your reply is the brief: it outranks the outline.
- **Ghostwriter.** It takes the seed and writes the whole article in your voice. A
  200-word note becoming a 1,300-word piece is the expected outcome, not overreach.
- **The line is facts, not length.** Structure, argument development, everyday
  analogies and explicitly hypothetical examples are the agent's to write. A number, a
  quote or a link may come from research, if the agent opened the source and lists it.
  Positions you haven't taken and anything *you personally did* are never invented and
  never looked up.
- **Checked before it ships.** The fingerprint scrub measures the draft against your
  published articles. The fact-check traces every claim to your note, your reply or a
  source, and requests every link.
- **The agent merges its own PR.** There is no manual review gate. Once
  `npm run generate` passes locally and the required check passes on the PR, the agent
  merges it. The PR body's "What I added" and "Sources" lists are what make the change
  auditable after the fact.
- **Then it hands you the post.** A LinkedIn draft on the issue, in a code block. The
  agent never posts anywhere on your behalf.

## Running it without the Action

The skills don't depend on the workflow file. Any agent with git, `gh` and a terminal
can be pointed at `skills/content-inbox/` to process the inbox by hand, and the
`in-progress` label keeps it from colliding with a run the Action started. A note
pasted into a chat goes through `skills/note-to-article/` directly.

## Cost and limits

- Each run uses GitHub Actions minutes and your Claude subscription (or API credit).
  An article is two runs; the second is the long one and is capped at 90 minutes.
- Runs for one issue never overlap. A reply posted while a run is busy waits for it.
- The explainer needs ffmpeg and Chromium, which the workflow installs for the second
  article run. If that fails, the article ships without the explainer and the issue
  says so.

## Rotating or revoking a credential

- **Shortcut token:** revoke on GitHub, generate a new one, edit the `Authorization`
  header in each Shortcut. Nothing else references it.
- **Claude credential:** run `claude setup-token` again and replace the
  `CLAUDE_CODE_OAUTH_TOKEN` secret. Deleting the secret stops every run at its first
  step.
- **Claude GitHub app:** uninstalling it from the repo stops the agent from pushing or
  commenting. To pause the workflow without removing anything, disable it under
  Actions → content-inbox → ⋯ → Disable workflow.

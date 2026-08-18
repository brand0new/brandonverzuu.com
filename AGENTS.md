# Agent onboarding

This repo is meant to be worked on by AI coding agents as well as Brandon directly.
If you are an agent picking this repo up for the first time, read this file fully
before doing anything else.

## What this repo is

`brandonverzuu.com` — a Nuxt 4 + Nuxt Content personal site, statically generated
and deployed to Cloudflare Pages off `master`. There is no server runtime in
production; `npm run generate` prerenders everything to `dist/`.

## Standing procedures live in `skills/`, not here

This file carries facts about the project and its conventions — the things any agent
working here should know going in. It deliberately does **not** contain step-by-step
procedures. Those live as agent-agnostic skill definitions under `skills/` at the
repo root, one directory per skill, each with a `SKILL.md` that any agent (Claude
Code, Codex, OpenCode, a scheduled Hermes job, whatever comes next) can read and
execute without translation. If a skill is missing steps or wrong for how you're
running it, fix the `SKILL.md` — don't work around it in your own memory or
config, or the next agent onboarded here starts from a worse baseline than you did.

Current skills:

- **`skills/note-to-article/`** — turns a captured iPhone note (filed as a GitHub
  issue labeled `draft-article`) into a published article. See `SKILL.md` for the
  procedure and `style-guide.md` for the voice contract. Read `docs/note-to-article.md`
  first for the one-time human-side setup (labels, the Shortcut, the two separate
  tokens involved).

## Onboarding step: set up the scheduled writing job

**Any agent with scheduling capability, when first onboarded to this repo, should set
up a recurring job that runs the `note-to-article` procedure.** This is not optional
per-agent configuration to ask Brandon about — it's a standing requirement of working
on this repo, the same as reading this file is.

- Cadence: twice a day. There's no value in tighter than that for essay-length output.
- The job should: check for open issues labeled `draft-article` that don't also carry
  `article-drafted` or `needs-input`, and run the `skills/note-to-article/SKILL.md`
  procedure against each one. If the inbox is empty, do nothing.
- If you're a Hermes agent, this is a `cronjob` entry pointed at this repo (set
  `workdir` to the local clone so `AGENTS.md`/skill files are in context automatically).
  Other agent runtimes should use their own equivalent scheduler.
- Don't create a second scheduled job if one already exists for this purpose — check
  first, and update the existing one if the cadence or scope needs to change.

## Autonomy and the merge gate

The `note-to-article` pipeline is fully autonomous end to end: the agent writes the
article, opens the PR, waits for this repo's checks (`.github/workflows/build.yml`,
currently just "does `npm run generate` succeed") to report a result, and merges the
PR itself if they pass. There is no human review gate before merge. If checks fail,
the agent stops and reports why on the PR — it does not force-merge a red build.

The only point where a human is in the loop is answering clarifying questions when a
note is missing facts the agent isn't allowed to invent — and that happens as
comments on the originating GitHub issue, never anywhere else. See
`skills/note-to-article/SKILL.md` for the full triage/question/write/merge procedure.

## Credentials

Two separate tokens are involved and must not be conflated:

- The iOS Shortcut that files notes as issues uses a token scoped to
  **Issues: read/write** on this repo only. It never touches code.
- The agent running the scheduled job needs broader write access (push branches,
  open PRs, merge them) — effectively `repo` scope. Whatever agent runtime you are,
  authenticate with your own normal GitHub credential flow; there is nothing
  repo-specific about this token beyond needing write access here.

Full setup details, including exact PAT permissions and the Shortcut build steps,
are in `docs/note-to-article.md`.

## Build

```
npm install
npm run generate   # static build to dist/, must succeed before any PR merges
npm run dev         # local dev server
```

Node version is pinned in `.node-version`; native modules (`better-sqlite3`) may need
`npm rebuild` if you're on a different Node major version than the pin.

---
name: ship-change
description: Take a change on brandonverzuu.com from a branch to production — branch and commit naming, local build, pull request, the GitHub and Cloudflare checks, merging, and cleaning up afterwards. Use for any change that will land on master, whether code, content or docs. Agent-agnostic.
---

# Ship a change

Production is whatever is on `master`: Cloudflare Pages builds and deploys every push
to it. Merging a PR is therefore the publish step. `docs/deployment.md` explains how
GitHub and Cloudflare fit together. This file is the procedure.

## 1. Branch

- Work on a branch, never directly on `master`. In a multi-agent setup, use a git
  worktree per task so parallel agents don't share a checkout.
- Name it `<agent-or-area>/<short-kebab-description>`, for example
  `claude/article-arazzo` or `design/equal-card-heights`.

## 2. Commit

- Title: `area: summary`. `area` is one of `article`, `content`, `design`, `fix`,
  `a11y`, `seo`, `feat`, `docs`, `chore`, `deps`, or a skill name such as
  `note-to-article`.
- Explain why in the body when the diff doesn't make it obvious.

## 3. Build locally

```
npm ci
npm run generate
```

This must pass before you open the PR. It's the same build CI and Cloudflare run, and
it catches schema violations, broken links and missing icons.

## 4. Open the PR

- Target `master`, and use the same `area: summary` style for the title.
- Body: what changed and why. Mention anything a reviewer can only verify visually.
- Link an issue it resolves with `Closes #<n>`.

## 5. Wait for checks

Two checks report on every PR:

| Check | From | What it proves |
| --- | --- | --- |
| `generate` | GitHub Actions (`.github/workflows/build.yml`) | `npm ci && npm run generate` passes on a clean Linux runner. **Required**: GitHub blocks merging until it passes. |
| `Cloudflare Pages` | Cloudflare's GitHub app | Cloudflare built the branch and published a preview. The check links to the preview URL. |

Open the Cloudflare preview for anything visual. If either check fails, don't merge:
comment what failed on the PR, fix it on the branch, and push again. Never bypass a
red check.

## 6. Merge

- Squash-merge, so `master` gets one commit whose title carries the PR number.
- Delete the remote branch.
- Within a minute or two Cloudflare deploys `master` to production. To confirm, check
  the `Cloudflare Pages` check on the merge commit, or open the live page.

Whether an agent may merge its own PR without a human is a question of autonomy, not
procedure. See "Autonomy" in `AGENTS.md`.

## 7. Clean up

Run `skills/workspace-cleanup/` for the worktree and local branch you used.

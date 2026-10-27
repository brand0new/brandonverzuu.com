# 00: Monorepo migration

Status: **implemented** on `claude/ecstatic-fermat-hk6jtr`. Two deviations from the
plan below, both to keep the change smaller: `scripts/` moved into `apps/site/`
(the scripts write into the site's `public/` and only serve the site), and
`wrangler.toml` stayed at the root, pointing at `apps/site/dist`, so the Pages
build keeps running from the root and no dashboard change should be needed.

## Scope

Turn the repo into an npm-workspaces monorepo without changing what the site
renders. Nothing else changes in this PR.

## Changes

- Root `package.json` becomes the workspace root: `"workspaces": ["apps/*", "packages/*"]`,
  `private: true`, and root scripts that delegate (`generate` →
  `npm run generate -w apps/site`, so the existing `generate` CI check name and the
  Pages build command keep working).
- `git mv` the site into `apps/site/`: `app/`, `content/`, `public/`,
  `content.config.ts`, `nuxt.config.ts`, `tsconfig.json`, and the site's
  dependencies. History is preserved by `git mv`.
- `scripts/`, `skills/`, `docs/`, `AGENTS.md` stay at the root. Every path they
  hard-code (`content/articles/…`, `public/articles/<slug>/cover.png`, the
  `npm run cover:generate` etc. scripts) is updated, and each skill's `SKILL.md`
  is updated to match. The content contract in `AGENTS.md` gets the new paths.
- `wrangler.toml` for Pages: `pages_build_output_dir = "./apps/site/dist"`, or move
  it next to the site, depending on which the Pages build reads (verify on preview).
- `.github/workflows/build.yml`: still `npm ci && npm run generate` from the root,
  same job name `generate`, so branch protection keeps matching.
- `.github/dependabot.yml`: one entry per workspace directory, or root only if
  Dependabot handles workspaces from the root lockfile (it does for npm v3
  lockfiles; verify).
- `.gitignore`: build output patterns made path-agnostic (`**/dist/`, `**/.nuxt/` …).
- Empty `apps/expert-mcp/`, `apps/cli/`, `packages/` and `products/skills/`
  placeholders with a README each, so later specs have a home.

## Cloudflare Pages

The dashboard build settings may need to change (build command, output directory).
That's outside the repo. The PR description lists the exact before/after values,
and `docs/deployment.md`'s dashboard table is updated in the same PR.

## Acceptance

- `npm ci && npm run generate` from the root produces a `dist/` byte-identical in
  route list to `master` (diff the file lists; content diffs only from build
  timestamps).
- The Cloudflare Pages preview for the branch renders the home page, one article,
  one review and `/topics` correctly in both themes.
- `npm run cover:generate`, `scrub:fingerprint` and `explainer:render` still run.
- One lockfile at the root.

## Out of scope

Any Worker code, any new dependency beyond what the move needs.

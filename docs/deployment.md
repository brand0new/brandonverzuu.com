# Deployment: GitHub and Cloudflare

How a commit becomes the live site, what runs where, and where each piece is
configured. For the step-by-step of shipping a change, see `skills/ship-change/`.

```
            push / PR                                   push to master
                │                                              │
     ┌──────────┴──────────┐                       ┌───────────┴───────────┐
     ▼                     ▼                       ▼                       ▼
GitHub Actions       Cloudflare Pages        GitHub Actions          Cloudflare Pages
`generate` check     preview build           `generate` check        production build
(required to merge)  → preview URL           (post-merge signal)     → brandonverzuu.com
                       (see below)
```

## The pieces

| Piece | Lives in | Role |
| --- | --- | --- |
| GitHub repo `brand0new/brandonverzuu.com` | GitHub | Source of truth. `master` is production. |
| `.github/workflows/build.yml` | this repo | Runs `npm ci && npm run generate` on every PR to `master` and every push to it. Reports the `generate` check. |
| Branch protection on `master` | GitHub → Settings → Branches | Requires the `generate` check to pass before a PR can merge. No force pushes or deletions. Admins aren't included (`enforce_admins` off), so an admin can still override the check. |
| Cloudflare Pages project `personal-site` | Cloudflare dashboard → Workers & Pages | Connected to the repo through the **Cloudflare Workers and Pages GitHub app**. Builds every pushed branch, deploys `master` to production and other branches as previews. Reports the `Cloudflare Pages` check. |
| `wrangler.toml` | this repo | Pages project config that the Cloudflare build reads: project name, output directory (`dist`) and compatibility date. |
| `nuxt.config.ts` → `nitro.preset: cloudflare_pages_static` | this repo | Makes `nuxt generate` emit a purely static `dist/` in the layout Pages expects. |
| `.node-version` | this repo | Node version for local work, GitHub Actions (`node-version-file`) and the Cloudflare build image. Keep it on a Node major that ships npm 11: Dependabot writes `package-lock.json` with npm 11, and npm 10's `npm ci` rejects those lockfiles (it expects optional peer dependencies npm 11 leaves out). |
| `.github/dependabot.yml` | this repo | Grouped weekly npm updates and monthly Actions updates, as PRs that go through the same checks. |
| Custom domain `brandonverzuu.com` | Cloudflare dashboard → the Pages project → Custom domains | Points the production deployment at the real domain. Previews stay on the project's `personal-site-46x.pages.dev` subdomain: `<hash>.personal-site-46x.pages.dev` per deployment, plus a stable `<branch>.personal-site-46x.pages.dev` alias per branch. Cloudflare's bot comments both on each PR. |

## Why the build runs twice

GitHub Actions and Cloudflare each run `npm run generate` independently. That's
deliberate:

- **The `generate` check is the merge gate.** It runs on a clean GitHub runner,
  GitHub can require it, and its logs are visible on the PR without a Cloudflare
  login.
- **The Cloudflare build is the deployment.** It produces the files that actually get
  served, and a preview URL for every branch.

They can disagree, for example when Cloudflare's build image or environment differs.
If the `Cloudflare Pages` check fails while `generate` passes, the problem is on the
Cloudflare side: check the build log linked from the check.

## What isn't used

- **No `wrangler pages deploy`.** Nothing uploads `dist/` by hand or from CI, so
  Cloudflare's Git integration is the only deploy path. The `wrangler` dev dependency
  remains for local `wrangler pages dev` checks against `dist/`.
- **No Pages Functions, no Workers, no runtime bindings.** If any are added, update
  `compatibility_date` in `wrangler.toml` and this document.
- **No GitHub → Cloudflare secrets.** The Cloudflare GitHub app has its own access to
  the repo, so the repo holds no Cloudflare API token.

## Cloudflare dashboard settings

These live outside the repo. Keep this table in sync when you change them.

| Setting | Value |
| --- | --- |
| Production branch | `master` |
| Preview deployments | all other branches |
| Build command | `npm run generate` *(confirm in dashboard)* |
| Build output directory | `dist` (also declared in `wrangler.toml`) |
| Node version | from `.node-version` *(confirm no `NODE_VERSION` override is set)* |

## Rolling back

Cloudflare dashboard → `personal-site` → Deployments → pick an earlier production
deployment → **Rollback**. This changes what's served immediately, without touching
git. Follow up with a revert PR so `master` matches what's live again.

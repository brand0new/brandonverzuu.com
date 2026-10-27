# brandonverzuu.com

My personal site: articles on APIs, platforms and technology, plus projects,
bookmarks and the tools I use. Built with Nuxt 4, Nuxt Content and Nuxt UI, statically
generated and served by Cloudflare Pages.

The repo is an npm-workspaces monorepo. The site lives in `apps/site/`; `apps/`,
`packages/` and `products/` also hold the paid expertise service as it's built
(see [`docs/specs/expert-mcp/`](docs/specs/expert-mcp/README.md)).

```
npm ci             # from the repo root, installs every workspace
npm run dev        # local dev server for the site
npm run generate   # static build to apps/site/dist/
```

- [`AGENTS.md`](AGENTS.md): what this project is, its principles and how the pieces
  fit together. The starting point for agents and humans alike.
- [`docs/deployment.md`](docs/deployment.md): how GitHub and Cloudflare turn a merge
  into the live site.
- [`docs/note-to-article.md`](docs/note-to-article.md): capturing article notes from
  an iPhone.
- [`skills/`](skills/): agent-agnostic procedures for shipping changes, writing
  articles, generating covers and explainers, and cleaning up.

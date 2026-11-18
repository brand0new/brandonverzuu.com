---
name: new-project
description: Add or update a project on the /projects page of brandonverzuu.com (apps/site/content/projects/). Use for a `draft-project` issue, or when Brandon asks to add or change a project. Agent-agnostic.
---

# New project

A project is one JSON file, `apps/site/content/projects/<n>.<name>.json`, matching the
`projects` schema in `apps/site/src/content.config.ts`, plus a thumbnail under
`apps/site/public/projects/`. The number in the filename orders the page.

For an inbox issue, `skills/content-inbox/` comes first: it covers the trust boundary,
the claim and the closing comment.

## 1. Collect the facts

Everything about a project is a fact about something Brandon built, so all of it comes
from him. Don't fill a gap from the project's own site or repository without asking:
that's a suggestion to put to him, not a source.

| Field | Notes |
| --- | --- |
| `name` | as he writes it |
| `url` | where the card links to; it must resolve |
| `description` | one sentence on what it does. Tidy his wording, don't sell it |
| `status` | free text, his call: `WIP`, `Live`, `Archived` |
| `opensource` | `true` or `false` |
| `thumbnail` | `/projects/<name>.svg` (see step 2) |
| `accentColor`, `accentFont` | optional, only when he asks for them |

If a required field is missing from the issue, ask for exactly the missing ones in one
comment (`skills/content-inbox/` step 5).

To **update** a project, edit its existing file and change only what he asked for.

## 2. Thumbnail

Use the image attached to the issue. Prefer an SVG, square, and save it as
`apps/site/public/projects/<name>.svg`. The existing ones are a 64×64 rounded tile with
a simple mark.

If no image is attached, ask for one. Don't draw a logo for his project yourself, and
don't take one from the project's site without him saying so.

## 3. Write the file

- A new project takes the next free number, so it lands at the end, unless he names a
  position. Renumbering other files to make room is fine: nothing links to the
  filenames.
- `accentColor` must stay readable in both themes. Check the card on the preview in
  light and dark.
- `accentFont` only works for a face registered in `apps/site/astro.config.mjs`
  `fonts`. An unregistered one falls back to the display face.

## 4. Ship it

Follow `skills/ship-change/`:

- Branch `<agent>/project-<name>`, title `content: project <name>`.
- Body: what was added or changed, and anything to look at on the preview.
- `Closes #<n>` for an inbox issue.

Then close the loop as `skills/content-inbox/` describes.

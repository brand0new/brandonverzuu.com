---
name: social-post
description: Draft the LinkedIn post that announces a published article on brandonverzuu.com and hand it to Brandon on the originating issue, for him to post himself. Use after an article's PR has merged and the page is live. Agent-agnostic.
---

# Social post

Publishing doesn't end at the merge: an article needs to be told about. The agent
writes the post, and Brandon sends it. **Never post it yourself**, on any account or
through any tool, even when one is available. A post under his name goes out by his
hand.

## 1. Wait until it's live

Draft only after the PR is merged and the article URL answers with a 200
(`https://brandonverzuu.com/articles/<slug>`). Cloudflare takes a minute or two after
the merge. A post that links to a 404 is worse than a late one.

## 2. Write it

- **Language** matches the article: a Dutch article gets a Dutch post.
- **Voice** is the article's voice, from `skills/note-to-article/style-guide.md` §2 and
  §5: first person, plain, a little self-deprecating. The anti-patterns in §9 apply
  here even more than in the article, because a feed is where they're most familiar.
- **Nothing new.** The post may only say what the article says. No extra claim, number
  or anecdote, and no opinion the article doesn't hold.
- **The opening lines do the work.** The feed cuts a post off after the first few
  lines, so the reason to read on has to be there: the question the article asks, or
  the observation it starts from. Not "I wrote a new article".
- **Shape**: 80 to 150 words, short paragraphs with blank lines between them, the link
  on its own line at the end. No bullet list of takeaways, no call for comments, no
  emoji opener.
- **Hashtags**: at most three, taken from the article's tags, on the last line.

If the article has an explainer, add one line under the draft saying a 4:5 feed cut can
be rendered with `npm run explainer:render -- <name> --format feed`
(`skills/article-explainer/` §4). The video is rendered and uploaded by hand.

## 3. Hand it over

Comment on the originating issue, in the same comment that reports the merge or right
after it. Put the post in a fenced code block, so it copies cleanly from the GitHub
app on a phone, and keep everything else in the comment to a line or two.

If there's no issue (the note was pasted into a chat), give him the post there.

Bookmarks and projects don't get a post.

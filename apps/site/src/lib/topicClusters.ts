// The topics I keep writing about. Each one groups articles by their existing frontmatter
// `tags`, so no extra content metadata is needed. The homepage's "What I do" chapter lists
// them, and /articles uses them as filters (/articles?topic=<slug>). The old /topics hub
// URLs redirect to those filters (public/_redirects).
//
// Adding a topic: add an entry here. Matching is purely by tag intersection against
// content/articles/*.md frontmatter `tags`, and an article can sit in more than one topic.
export interface TopicCluster {
  slug: string;
  title: string;
  /** One line of framing, shown on the homepage. */
  summary: string;
  /** Article frontmatter tags that belong to this topic. */
  tags: string[];
}

export const topicClusters: TopicCluster[] = [
  {
    slug: "ai",
    title: "AI",
    summary: "What it actually costs, not just what it promises, to hand decisions to AI.",
    tags: ["ai", "social contract", "ethics", "technology"],
  },
  {
    slug: "blockchain",
    title: "Blockchain",
    summary: "Understanding what a blockchain is actually good for, beyond the speculation.",
    tags: ["blockchain", "crypto", "bitcoin", "finance", "africa"],
  },
  {
    slug: "integration-architecture",
    title: "Integration architecture",
    summary: "Platforms and integration patterns that hold up, even when the people doing the work aren't your own employees.",
    tags: ["cloud-integration", "maturity-model"],
  },
  {
    slug: "apis",
    title: "APIs",
    summary: "Making governance executable, not aspirational: linting, specs and tooling that keep API quality consistent at scale.",
    tags: ["api", "governance", "openapi", "arazzo", "overlay", "linting", "developer experience"],
  },
];

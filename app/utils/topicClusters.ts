// Topic cluster definitions for the /topics hub pages (SEO/AI-discoverability
// Phase 3 — see the plan agreed with Brandon). Each cluster groups articles
// by their existing frontmatter `tags` so a single canonical page can
// establish topical authority for that theme, without requiring a new
// content collection or duplicating article metadata.
//
// Deliberately three clusters, not one: Brandon's positioning is a broad
// cloud/API + emerging-tech practitioner, not a single-niche specialist —
// see the corpus split (API governance content, one AI/trust piece, three
// blockchain pieces). One hub page would either dilute the API cluster or
// force blockchain/AI content under an ill-fitting umbrella.
//
// Adding a new cluster later: add an entry here: matching is purely by tag
// intersection against content/articles/*.md frontmatter `tags`, no other
// wiring needed — /topics/index.vue and /topics/[slug].vue both read this
// array directly.
export interface TopicCluster {
  slug: string;
  title: string;
  /** Short framing shown on the /topics index card. */
  summary: string;
  /** Longer framing shown at the top of the cluster's own hub page. */
  intro: string;
  /** Article frontmatter tags that belong to this cluster. */
  tags: string[];
  /** Iconify icon name (mage set, already bundled — see nuxt.config.ts
   *  icon.clientBundle) shown on the /topics index card and the cluster's
   *  own hub page, giving each theme a distinct at-a-glance identity. */
  icon: string;
}

export const topicClusters: TopicCluster[] = [
  {
    slug: "api-governance-integration",
    title: "API Governance & Integration Architecture",
    summary:
      "Making governance executable, not aspirational — linting, specs, and platforms that keep integration quality consistent at scale.",
    intro:
      "Most of what I write about comes back to the same problem: organisations know what good API design and integration architecture look like, but knowing it and enforcing it are two different things. This is the collection of articles where I dig into that gap — automating governance instead of documenting it, using OpenAPI and its surrounding tooling (Arazzo, Overlay) to make the right path the easy path, and building platforms that hold up even when the people doing the integration work aren't your own employees.",
    tags: [
      "governance",
      "api",
      "openapi",
      "arazzo",
      "overlay",
      "linting",
      "developer experience",
      "maturity-model",
      "cloud-integration",
    ],
    icon: "mage:server-fill",
  },
  {
    slug: "ai-trust-and-ethics",
    title: "AI, Trust & the Social Contract",
    summary:
      "What it actually costs — not just what it promises — to hand decisions to AI.",
    intro:
      "I'm a tech-optimist, but optimism that never pays a cost isn't worth much. This is where I think through what trusting AI with more of our decisions actually asks of us — not the theoretical version, the one where someone has to decide how much autonomy is reasonable to hand over, and what happens when that trust is misplaced.",
    tags: ["ai", "social contract", "ethics", "technology"],
    icon: "mage:robot-fill",
  },
  {
    slug: "blockchain-and-crypto",
    title: "Blockchain & Cryptocurrency",
    summary:
      "Understanding what a blockchain is actually good for, beyond the speculation.",
    intro:
      "Blockchain got sold as a solution looking for a problem for long enough that it's easy to dismiss outright — I don't think that's fair either. These articles are me working through what a blockchain actually does well, where the value genuinely sits, and where the technology gets applied for reasons that go beyond a token price.",
    tags: ["blockchain", "crypto", "bitcoin", "finance", "africa"],
    icon: "mage:coin-a-fill",
  },
];

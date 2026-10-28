<template>
  <main class="min-h-screen">
    <ExpertSectionNav />
    <AppHeader class="mb-8" title="Expertise">
      <p>
        When I review an API specification, an agent skill or a process
        description, I check it against standards I've written down for myself.
        This service turns those checks into something your agent or CI pipeline
        can call: you send an artifact and get back the findings I'd give an
        employer or client.
      </p>
      <p>
        The answers come from rules I wrote and maintain, not from a language
        model. The same input gets the same result.
      </p>
    </AppHeader>

    <ExpertNotice label="Coming soon" class="mb-12">
      <p>
        Nothing here is live yet. There are no accounts and no payments. This
        page describes what I'm building, and details may still change.
      </p>
    </ExpertNotice>

    <section aria-labelledby="checks-heading" class="mb-12">
      <h2 id="checks-heading" class="mb-4 text-2xl!">Three checks</h2>
      <ul class="space-y-4">
        <li v-for="check in checks" :key="check.kind">
          <article
            class="rounded-xl border border-gray-200 p-5 dark:border-white/10"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="text-xl! dark:text-gray-100">{{ check.name }}</h3>
              <span
                class="text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                {{ formatCredits(check.credits) }} per artifact
              </span>
            </div>
            <dl class="mt-3 space-y-2 text-sm">
              <div>
                <dt class="font-medium text-gray-900 dark:text-gray-100">
                  You give
                </dt>
                <dd class="text-gray-700 dark:text-gray-300">
                  {{ check.give }}
                </dd>
              </div>
              <div>
                <dt class="font-medium text-gray-900 dark:text-gray-100">
                  You get
                </dt>
                <dd class="text-gray-700 dark:text-gray-300">
                  {{ check.get }}
                </dd>
              </div>
            </dl>
          </article>
        </li>
      </ul>
      <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
        Credit prices aren't set yet. See
        <NuxtLink to="/expert/pricing" :class="linkClass">pricing</NuxtLink>.
      </p>
    </section>

    <section aria-labelledby="ways-heading" class="body-text mb-12 space-y-4">
      <h2 id="ways-heading" class="text-2xl!">Three ways in</h2>
      <p>All three call the same checks and spend the same credits.</p>
      <h3 class="text-xl!">MCP, for agents</h3>
      <p>
        Point your agent at
        <code :class="codeClass">https://mcp.brandonverzuu.com/mcp</code>. You
        sign in with OAuth, and the server offers the checks as tools, together
        with skills that tell the agent when to use them.
      </p>
      <h3 class="text-xl!">The CLI, for people and coding agents</h3>
      <p>
        <code :class="codeClass">bv-expertise</code>, from the npm package
        <code :class="codeClass">@brandonverzuu/expertise</code>. It checks your
        input locally before sending it, so a malformed file never costs
        credits, and it can write text, JSON, SARIF or Markdown.
      </p>
      <pre
        class="overflow-x-auto rounded-lg bg-gray-100 p-4 font-mono text-sm text-gray-800 dark:bg-white/10 dark:text-gray-200"
      ><code>bv-expertise login
bv-expertise check api openapi.yaml
bv-expertise check skill ./my-skill
bv-expertise review process process.json</code></pre>
      <h3 class="text-xl!">REST, for CI</h3>
      <p>
        <code :class="codeClass">POST /v1/checks/{kind}</code> on the same host,
        with an account API token. In a pipeline, the CLI does this for you and
        can fail the build on errors or warnings. Its SARIF output shows
        findings in GitHub code scanning.
      </p>
    </section>

    <section aria-labelledby="prep-heading" class="body-text mb-12 space-y-4">
      <h2 id="prep-heading" class="text-2xl!">Skills and the process format</h2>
      <p>
        Public skills tell your agent when a check is worth running, how to
        prepare the input and how to read the result. They don't contain the
        rules. They'll be published in this site's
        <NuxtLink
          to="https://github.com/brand0new/brandonverzuu.com"
          external
          target="_blank"
          :class="linkClass"
          >public repository<span class="sr-only">
            (opens in new tab)</span
          ></NuxtLink
        >
        and served over MCP.
      </p>
      <!-- TODO: link the schema once /schemas/process-description/v1.json
           exists (spec 04 builds it in packages/check-kit; spec 07 serves it). -->
      <p>
        The process review needs your process in a structured format. I'm
        publishing it as a JSON Schema at
        <code :class="codeClass">/schemas/process-description/v1.json</code>.
        The skill helps your agent turn a prose description into it, and asks
        you for anything that's missing instead of making it up.
      </p>
    </section>

    <section aria-labelledby="buying-heading" class="body-text space-y-4">
      <h2 id="buying-heading" class="text-2xl!">Buying credits</h2>
      <p>
        Checks are paid in credits, bought in packs. A check takes its credits
        when it runs, and gives them back if it fails on my side.
      </p>
      <p>
        An agent that supports the Agentic Commerce Protocol can buy a pack
        through checkout on the MCP server, once you've approved it. Without
        that, you get a Stripe payment link from your agent or from
        <code :class="codeClass">bv-expertise buy</code>.
      </p>
      <p>
        There's no free trial. Every check is paid. See
        <NuxtLink to="/expert/pricing" :class="linkClass">pricing</NuxtLink>,
        the <NuxtLink to="/expert/terms" :class="linkClass">terms</NuxtLink> and
        the
        <NuxtLink to="/expert/privacy" :class="linkClass"
          >privacy statement</NuxtLink
        >.
      </p>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { CheckKind } from "~/utils/expertPricing";
import { codeClass, linkClass } from "~/utils/expertStyles";

const { data: pricing } = await useAsyncData("expert-pricing", () =>
  queryCollection("expertPricing").first(),
);

// What goes in and what comes out, per check (docs/specs/expert-mcp/README.md).
// Names and prices come from content/expert/pricing.yml.
const descriptions: Record<CheckKind, { give: string; get: string }> = {
  "api-governance": {
    give: "An OpenAPI 3.0 or 3.1 document.",
    get: "Findings with a severity, the JSONPath where they apply, the issue and a fix, plus a governance score per dimension.",
  },
  "skill-design": {
    give: "An Agent Skill folder: SKILL.md and the files next to it.",
    get: "Findings on structure, triggering, scope, progressive disclosure and safety, by file and line, plus a score.",
  },
  "process-review": {
    give: "A process description in the published process format.",
    get: "Findings on roles, handoffs, controls, exceptions and measurability, plus a score.",
  },
};

const checks = computed(() =>
  (pricing.value?.checks ?? []).map((check) => ({
    ...check,
    ...descriptions[check.kind],
  })),
);

const description =
  "Paid, agent-callable checks for OpenAPI documents, Agent Skills and process descriptions, by Brandon Verzuu. Coming soon.";

useSeoMeta({
  title: "Expertise | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/expert",
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>

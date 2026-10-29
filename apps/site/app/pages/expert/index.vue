<template>
  <main class="min-h-screen">
    <UBadge
      label="Coming soon"
      variant="subtle"
      size="sm"
      class="mb-4 rounded-full text-porcelain-700 dark:text-porcelain-300"
    />
    <AppHeader class="mb-12" title="Expertise">
      <p>
        When I review an API specification, an agent skill or a process
        description, I check it against standards I've written down for myself.
        This service turns those checks into something your agent or CI pipeline
        can call: you send an artifact and get back the findings I'd give an
        employer or client.
      </p>
      <p>
        The answers come from rules I wrote and maintain, not from a language
        model, so the same input gets the same result. Nothing is live yet: this
        page describes what I'm building, and details may still change.
      </p>
    </AppHeader>

    <div class="space-y-24">
      <section aria-labelledby="checks-heading">
        <h2 id="checks-heading" class="mb-6">Three checks</h2>
        <ul class="space-y-4">
          <li v-for="check in checks" :key="check.kind">
            <ExpertCheckCard :check="check" :currency="currency" />
          </li>
        </ul>
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Planned prices in euros, excluding VAT.
        </p>
      </section>

      <section aria-labelledby="ways-heading">
        <h2 id="ways-heading" class="mb-6">Three ways in</h2>
        <ul class="space-y-4">
          <li v-for="way in ways" :key="way.name">
            <article
              class="relative flex items-start gap-4 rounded-xl border border-gray-200 p-5 dark:border-white/10"
            >
              <client-only>
                <Icon
                  aria-hidden="true"
                  :name="way.icon"
                  class="mt-1 h-6 w-6 flex-none text-terracotta-heading dark:text-terracotta"
                />
              </client-only>
              <div class="min-w-0 flex-1">
                <h3 class="text-xl! dark:text-gray-100">{{ way.name }}</h3>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {{ way.text }}
                </p>
                <code
                  :class="codeClass"
                  class="mt-3 inline-block text-sm break-all"
                  >{{ way.example }}</code
                >
              </div>
            </article>
          </li>
        </ul>
      </section>

      <section aria-labelledby="prep-heading" class="body-text space-y-4">
        <h2 id="prep-heading" class="mb-6">Skills and the process format</h2>
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

      <section aria-labelledby="paying-heading" class="body-text space-y-4">
        <h2 id="paying-heading" class="mb-6">Paying per check</h2>
        <p>
          You pay for each check as you run it. There are no packs and no
          balance. You see the price for your file first, and a check that fails
          on my side isn't charged.
        </p>
        <p>
          Payment goes with the request itself: over x402, in EURC or USDC from
          a wallet linked to your account, or over Stripe's Machine Payments
          Protocol in euros. Your agent or the CLI asks you before it pays.
          There's no free trial.
        </p>
        <!-- The way to the other /expert pages, styled like the "All
             articles" links under the homepage sections. -->
        <div
          class="flex flex-wrap items-center justify-center gap-6 pt-6 text-sm"
        >
          <UButton
            v-for="link in links"
            :key="link.to"
            :label="`${link.label} →`"
            :to="link.to"
            variant="link"
            color="primary"
            class="text-primary-700 dark:text-primary-400"
          />
        </div>
      </section>
    </div>
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

const currency = computed(() => pricing.value?.currency ?? "EUR");

const ways = [
  {
    name: "MCP, for agents",
    icon: "mage:robot-fill",
    text: "Sign in with OAuth and the server offers the checks as tools, with skills that tell your agent when to use them.",
    example: "https://mcp.brandonverzuu.com/mcp",
  },
  {
    name: "The CLI, for people and coding agents",
    icon: "mage:keyboard-fill",
    text: "bv-expertise, from the npm package @brandonverzuu/expertise. It validates your file locally first, so a malformed one never costs anything, and writes text, JSON, SARIF or Markdown.",
    example: "bv-expertise check api openapi.yaml",
  },
  {
    name: "REST, for CI",
    icon: "mage:dashboard-check-fill",
    text: "The same checks over HTTP with an account API token. In a pipeline the CLI does this for you, can fail the build on errors, and its SARIF output shows findings in GitHub code scanning.",
    example: "POST /v1/checks/{kind}",
  },
];

const links = [
  { label: "Pricing", to: "/expert/pricing" },
  { label: "Terms", to: "/expert/terms" },
  { label: "Privacy", to: "/expert/privacy" },
];

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

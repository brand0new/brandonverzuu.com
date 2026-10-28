<template>
  <main class="min-h-screen">
    <ExpertSectionNav />
    <AppHeader class="mb-8" title="Pricing">
      <p>
        You buy credits in packs and spend them per check. Each check costs a
        fixed number of credits per artifact. There's no free trial and no
        subscription.
      </p>
    </AppHeader>

    <ExpertNotice label="Coming soon" class="mb-12">
      <p>
        These are the planned prices. They may still change before the service
        goes live.
      </p>
    </ExpertNotice>

    <template v-if="pricing">
      <section aria-labelledby="packs-heading" class="mb-12">
        <h2 id="packs-heading" class="mb-4 text-2xl!">Credit packs</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">
              Credit packs, prices in
              {{
                pricing.currency
              }}
            </caption>
            <thead>
              <tr
                class="border-b border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-400"
              >
                <th scope="col" class="py-2 pr-4 font-medium">Pack</th>
                <th scope="col" class="py-2 pr-4 font-medium">Price</th>
                <th scope="col" class="py-2 font-medium">Per credit</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="pack in pricing.packs"
                :key="pack.id"
                class="border-b border-gray-200 text-gray-900 dark:border-white/10 dark:text-gray-100"
              >
                <th scope="row" class="py-3 pr-4 font-semibold">
                  {{ formatCredits(pack.credits) }}
                </th>
                <td class="py-3 pr-4">
                  {{ formatPrice(pack.price, pricing.currency) }}
                </td>
                <td class="py-3">
                  {{ pricePerCredit(pack, pricing.currency) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Prices in euros, excluding VAT. Payment runs through Stripe.
        </p>
        <p
          v-if="pricing.annualCommitment"
          class="mt-2 text-sm text-gray-600 dark:text-gray-400"
        >
          For teams: an annual commitment from
          {{
            formatPrice(pricing.annualCommitment.priceFrom, pricing.currency)
          }}
          a year. {{ pricing.annualCommitment.note }}
        </p>
      </section>

      <section aria-labelledby="checks-heading" class="mb-12">
        <h2 id="checks-heading" class="mb-4 text-2xl!">Credits per check</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">
              Credits charged per artifact, by check
            </caption>
            <thead>
              <tr
                class="border-b border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-400"
              >
                <th scope="col" class="py-2 pr-4 font-medium">Check</th>
                <th scope="col" class="py-2 font-medium">Per artifact</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="check in pricing.checks"
                :key="check.kind"
                class="border-b border-gray-200 text-gray-900 dark:border-white/10 dark:text-gray-100"
              >
                <th scope="row" class="py-3 pr-4 font-semibold">
                  {{ check.name }}
                </th>
                <td class="py-3">
                  {{ formatCredits(check.credits) }}
                  <span
                    v-if="check.note"
                    class="block text-gray-600 dark:text-gray-400"
                  >
                    {{ check.note }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Credits are taken when a check runs and given back automatically if
          the check fails on my side.
        </p>
      </section>
    </template>

    <section aria-labelledby="buying-heading" class="body-text space-y-4">
      <h2 id="buying-heading" class="text-2xl!">How you pay</h2>
      <p>
        If your agent supports the Agentic Commerce Protocol, it can buy a pack
        through checkout on the MCP server, after you've approved the purchase.
        Otherwise you get a Stripe payment link, from your agent or from
        <code :class="codeClass">bv-expertise buy</code>.
      </p>
      <p>
        The details are in the
        <NuxtLink to="/expert/terms" :class="linkClass">terms</NuxtLink>
        and the
        <NuxtLink to="/expert/privacy" :class="linkClass"
          >privacy statement</NuxtLink
        >.
      </p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { codeClass, linkClass } from "~/utils/expertStyles";

const { data: pricing } = await useAsyncData("expert-pricing", () =>
  queryCollection("expertPricing").first(),
);

const description =
  "Credit packs and per-check prices for Brandon Verzuu's expertise service. Coming soon.";

useSeoMeta({
  title: "Pricing | Expertise | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/expert/pricing",
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>

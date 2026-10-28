<template>
  <main class="min-h-screen">
    <ExpertSectionNav />
    <AppHeader class="mb-8" title="Pricing">
      <p>
        You pay per check, each time you run one. There are no packs, no balance
        and no subscription, and there's no free trial.
      </p>
    </AppHeader>

    <ExpertNotice label="Coming soon" class="mb-12">
      <p>
        These are the planned prices. They may still change before the service
        goes live.
      </p>
    </ExpertNotice>

    <section v-if="pricing" aria-labelledby="checks-heading" class="mb-12">
      <h2 id="checks-heading" class="mb-4 text-2xl!">Price per check</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <caption class="sr-only">
            Price per artifact, by check, in
            {{
              pricing.currency
            }}
            excluding VAT
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
                {{ formatPrice(check.price, pricing.currency) }}
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
        Prices in euros, excluding VAT. You see the exact price for your file
        before anything is charged, and a check that fails on my side isn't
        charged at all.
      </p>
    </section>

    <section aria-labelledby="paying-heading" class="body-text space-y-4">
      <h2 id="paying-heading" class="text-2xl!">How you pay</h2>
      <p>
        Each check is paid on the request itself, in one of two ways. Your agent
        or the CLI asks you before it pays.
      </p>
      <ul class="list-disc space-y-2 pl-5">
        <li>
          <strong>x402</strong>, in EURC or USDC on Base, from a wallet you've
          linked to your account. Payments on a blockchain are public.
        </li>
        <li>
          <strong>Stripe's Machine Payments Protocol</strong>, in euros, if
          you'd rather not use a crypto wallet.
        </li>
      </ul>
      <p>
        Every month you get a statement of all your payments, with VAT. The
        details are in the
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
import { linkClass } from "~/utils/expertStyles";

const { data: pricing } = await useAsyncData("expert-pricing", () =>
  queryCollection("expertPricing").first(),
);

const description =
  "Prices per check for Brandon Verzuu's expertise service, paid per request over x402 or Stripe. Coming soon.";

useSeoMeta({
  title: "Pricing | Expertise | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/expert/pricing",
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>

<template>
  <main class="min-h-screen">
    <AppBreadcrumb
      :items="[
        { label: 'Home', to: '/' },
        { label: 'Expertise', to: '/expert' },
        { label: 'Pricing' },
      ]"
    />
    <AppHeader class="mb-12" title="Pricing">
      <p>
        You pay per check, each time you run one. There are no packs, no balance
        and no subscription, and there's no free trial. These are the planned
        prices, and they may still change before the service goes live.
      </p>
    </AppHeader>

    <div class="space-y-24">
      <section v-if="pricing" aria-labelledby="checks-heading">
        <h2 id="checks-heading" class="mb-6">Price per check</h2>
        <ul class="space-y-4">
          <li v-for="check in pricing.checks" :key="check.kind">
            <ExpertCheckCard :check="check" :currency="pricing.currency" />
          </li>
        </ul>
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Prices in euros, excluding VAT. You see the exact price for your file
          before anything is charged, and a check that fails on my side isn't
          charged at all.
        </p>
      </section>

      <section aria-labelledby="paying-heading" class="body-text space-y-4">
        <h2 id="paying-heading" class="mb-6">How you pay</h2>
        <p>
          Each check is paid on the request itself, in one of two ways. Your
          agent or the CLI asks you before it pays.
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
        <p>Every month you get a statement of all your payments, with VAT.</p>
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
const links = [
  { label: "Terms", to: "/expert/terms" },
  { label: "Privacy", to: "/expert/privacy" },
];

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

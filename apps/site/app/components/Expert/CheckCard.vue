<template>
  <!-- The site's card shell (conventions.md) without the hover states: a
       check has no page of its own to link to. -->
  <article
    class="relative flex items-start gap-4 rounded-xl border border-gray-200 p-5 dark:border-white/10"
  >
    <client-only>
      <Icon
        aria-hidden="true"
        :name="check.icon"
        class="mt-1 h-6 w-6 flex-none text-terracotta-heading dark:text-terracotta"
      />
    </client-only>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="text-xl! dark:text-gray-100">{{ check.name }}</h3>
        <UBadge
          :label="`${formatPrice(check.price, currency)} per artifact`"
          variant="subtle"
          size="sm"
          class="rounded-full text-porcelain-700 dark:text-porcelain-300"
        />
      </div>
      <dl v-if="check.give || check.get" class="mt-3 space-y-2 text-sm">
        <div v-if="check.give">
          <dt class="font-medium text-gray-900 dark:text-gray-100">You give</dt>
          <dd class="text-gray-600 dark:text-gray-400">{{ check.give }}</dd>
        </div>
        <div v-if="check.get">
          <dt class="font-medium text-gray-900 dark:text-gray-100">You get</dt>
          <dd class="text-gray-600 dark:text-gray-400">{{ check.get }}</dd>
        </div>
      </dl>
      <!-- A span, not a p: the global p rule in main.css sets 16px and
           would override text-xs (same reason TopicCard uses a span). -->
      <span
        v-if="check.note"
        class="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-400"
      >
        {{ check.note }}
      </span>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { ExpertCheckPrice } from "~/utils/expertPricing";

defineProps<{
  /** A check from content/expert/pricing.yml, optionally with the page's
   *  "you give / you get" copy merged in by the caller. */
  check: ExpertCheckPrice & { give?: string; get?: string };
  currency: string;
}>();
</script>

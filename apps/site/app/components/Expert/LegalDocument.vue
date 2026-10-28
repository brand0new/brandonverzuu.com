<template>
  <!-- Shared body of /expert/terms and /expert/privacy. The page fetches the
       newest published version and passes it in; while there is none
       (only drafts exist), a "being drafted" badge stands in for the text. Drafts are
       never rendered, so unapproved wording can't read as binding. -->
  <article class="prose max-w-none dark:prose-invert">
    <h1>{{ title }}</h1>
    <template v-if="document">
      <p class="not-prose text-sm text-gray-600 dark:text-gray-400">
        Version {{ document.version }}, {{ readableDate }}
      </p>
      <ContentRenderer :value="document" />
    </template>
    <div v-else class="not-prose">
      <UBadge
        label="Being drafted"
        variant="subtle"
        size="sm"
        class="rounded-full text-porcelain-700 dark:text-porcelain-300"
      />
      <p class="body-text mt-4 text-lg leading-relaxed">
        This text is still being written. The service isn't live yet, and it
        won't go live before the final version is published here.
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type {
  ExpertPrivacyCollectionItem,
  ExpertTermsCollectionItem,
} from "@nuxt/content";

const props = defineProps<{
  title: string;
  /** Newest published version, or null while only drafts exist. */
  document: ExpertTermsCollectionItem | ExpertPrivacyCollectionItem | null;
}>();

const readableDate = computed(() =>
  props.document
    ? new Date(props.document.date).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "",
);
</script>

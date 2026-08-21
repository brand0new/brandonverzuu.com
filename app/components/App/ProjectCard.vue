<template>
  <NuxtLink
    class="group block"
    :to="props.project.url"
    target="_blank"
    external
  >
    <article
      class="relative flex items-start gap-4 rounded-xl border border-gray-200 p-5 transition-colors group-hover:border-gray-300 dark:border-white/10 dark:group-hover:border-white/20"
    >
      <UAvatar
        :src="props.project.thumbnail"
        size="lg"
        :alt="props.project.name"
        class="flex-none"
        :style="avatarStyle"
      />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2
            class="group-hover:text-primary-600 dark:text-gray-100"
            :style="titleStyle"
          >
            {{ props.project.name }}
            <span class="sr-only">(opens in new tab)</span>
          </h2>
          <UBadge
            v-if="props.project.status"
            :label="props.project.status"
            variant="subtle"
            size="sm"
            class="rounded-full text-porcelain-700 dark:text-porcelain-300"
          />
          <UBadge
            v-if="props.project.opensource"
            label="Open source"
            variant="subtle"
            color="neutral"
            size="sm"
            class="rounded-full"
          />
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ props.project.description }}
        </p>
      </div>
    </article>
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps({
  project: {
    type: Object as () => {
      name: string;
      description: string;
      url: string;
      thumbnail: string;
      status?: string;
      opensource?: boolean;
      accentColor?: string;
      accentFont?: string;
    },
    required: true,
  },
});

// Per-project accent color/font, driven by content data rather than a
// hardcoded per-slug class in this component's <style> block — the old
// approach (e.g. `.abcdates { font-family: "Telma"; color: #fe6e8b }`)
// required a code change for every new project. Falls back to no inline
// override, letting the default text/hover colors and heading font apply.
const titleStyle = computed(() => ({
  ...(props.project.accentColor ? { color: props.project.accentColor } : {}),
  ...(props.project.accentFont
    ? { fontFamily: props.project.accentFont }
    : {}),
}));
const avatarStyle = computed(() =>
  props.project.accentColor
    ? { backgroundColor: `${props.project.accentColor}1a` }
    : {},
);
</script>

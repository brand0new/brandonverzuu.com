<script setup>
const colorMode = useColorMode();

const isDark = computed({
  get() {
    return colorMode.value === "dark";
  },
  set() {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
  },
});
</script>

<template>
  <UTooltip text="Toggle theme" :ui="{ popper: { strategy: 'absolute' } }">
    <button
      class="relative px-3 py-4 flex items-center justify-center transition hover:text-primary-500 dark:hover:text-primary-400"
      @click="isDark = !isDark">
      <ClientOnly>
        <Icon aria-hidden="true" :name="isDark ? 'mage:moon-fill' : 'mage:sun'" class="w-5 h-5" />
        <template #fallback>
          <div class="w-5 h-5"></div>
        </template>
      </ClientOnly>
      <span class="sr-only">Toggle theme</span>
    </button>
  </UTooltip>
</template>

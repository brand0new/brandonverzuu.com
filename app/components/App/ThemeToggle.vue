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
      class="hover:text-primary-500 dark:hover:text-primary-400 relative flex items-center justify-center px-3 py-4 transition"
      :aria-pressed="isDark"
      @click="isDark = !isDark"
    >
      <ClientOnly>
        <Icon
          aria-hidden="true"
          :name="isDark ? 'mage:moon-fill' : 'mage:sun'"
          class="h-5 w-5"
        />
        <template #fallback>
          <div class="h-5 w-5"></div>
        </template>
      </ClientOnly>
      <span class="sr-only">Toggle theme</span>
    </button>
  </UTooltip>
</template>

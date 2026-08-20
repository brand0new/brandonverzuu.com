<template>
  <UApp>
    <AppNavbar />
    <div class="h-32"></div>
    <UContainer class="mx-auto max-w-xl lg:max-w-2xl">
      <NuxtPage />
    </UContainer>
    <div class="h-32"></div>
    <AppFooter />
  </UApp>
</template>

<script setup lang="ts">
// Applies a self-referencing canonical <link> to every route from one place
// (see app/composables/useCanonical.ts) so it can't be missed on new pages.
useCanonical();
</script>

<style>
.page-enter-active,
.page-leave-active {
  transition: all 0.2s;
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(5px);
}
</style>

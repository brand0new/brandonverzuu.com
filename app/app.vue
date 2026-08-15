<template>
  <UApp>
    <AppNavbar />
    <div class="h-32"></div>
    <UContainer class="max-w-xl lg:max-w-2xl mx-auto">
      <NuxtPage />
    </UContainer>
    <div class="h-32"></div>
    <AppFooter />
  </UApp>
</template>

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

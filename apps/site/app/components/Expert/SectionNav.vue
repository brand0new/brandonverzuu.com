<template>
  <!-- Links between the /expert pages only. The section deliberately has no
       entry in the main nav or anywhere else on the site while the service
       isn't live (spec 07); the sitemap is its only way in. It sits over
       the dithered page background, hence the translucent backing: even
       over solid terracotta, gray-600 on the light backing measures 6.5:1
       and gray-400 on the dark one 5.1:1. -->
  <nav aria-label="Expertise service" class="mb-10">
    <ul
      class="inline-flex flex-wrap gap-x-5 gap-y-1 rounded-2xl bg-white/85 px-4 py-1.5 text-sm font-medium ring-1 ring-gray-900/5 backdrop-blur dark:bg-gray-900/80 dark:ring-white/10"
    >
      <li v-for="link in links" :key="link.to">
        <NuxtLink
          :to="link.to"
          class="text-gray-600 hover:text-primary-700 dark:text-gray-400 dark:hover:text-primary-400"
          exact-active-class="text-gray-900! underline underline-offset-4 dark:text-gray-100!"
        >
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
// NuxtLink sets aria-current="page" on the exact-active link itself.
const links = [
  { to: "/expert", label: "Overview" },
  { to: "/expert/pricing", label: "Pricing" },
  { to: "/expert/terms", label: "Terms" },
  { to: "/expert/privacy", label: "Privacy" },
];
</script>

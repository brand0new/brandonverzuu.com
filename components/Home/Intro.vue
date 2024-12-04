<template>
  <div class="space-y-6">
    <NuxtImg src="/avatar.jpg" alt="Brandon Verzuu"
      class="ring-2 border ring-gray-200 border-gray-300 dark:ring-white/10 dark:border-gray-800 hover:ring-4 transition-all duration-300 bg-gray-200 dark:bg-gray-900 rounded-full h-12 w-12 sm:h-16 sm:w-16"
      sizes="48px sm:64px" placeholder format="webp" />
    <h1 class="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
      Hello!
    </h1>
    <p class="text-gray-900 dark:text-gray-400">
      I am a solution architect from Rosmalen, The Netherlands.
      I support organisations with the integration of their systems. Focussing on Cloud Integration, web-based APIs and API strategy development.
    </p>
    <p class="text-gray-900 dark:text-gray-400">
      Compasionate about software development and technology in general.
      I love diving into things I don't understand in order to dissect, understand and make them accessible for others.
    </p>
    <p class="text-gray-900 dark:text-gray-400">
      I don't spent enough time writing on this site...
    </p>
  </div>
</template>

<script setup>
useSeoMeta({
  title: "Brandon Verzuu",
  description:
    "A compasionate cloud integration architect and software developer trying to understand stuff.",
});
</script>

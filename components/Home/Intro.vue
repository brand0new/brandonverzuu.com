<template>
  <div class="prose space-y-6">
    <div class="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4">
      <UAvatar src="/avatar.jpg" size="3xl" />
      <h1 class="text-7xl font-extrabold dark:text-gray-100 text-center md:text-left mb-0">
        Hi, I'm Brandon!
      </h1>
    </div>
    <p class="text-gray-900 dark:text-gray-400">
      I am a solution architect from Rosmalen, The Netherlands.
      I support organisations with the integration of their systems. Focussing on Cloud Integration, web-based APIs and
      API strategy development.
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

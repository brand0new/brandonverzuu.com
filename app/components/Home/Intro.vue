<template>
  <div class="space-y-6">
    <div
      class="flex flex-col items-center space-y-4 md:flex-row md:space-y-0 md:space-x-4"
    >
      <h1 class="mb-0 md:text-left dark:text-gray-100">Hi, I'm Brandon!</h1>
    </div>
    <p class="text-gray-900 dark:text-gray-400">
      I am Head of Innovation & Product, based in Rosmalen, The Netherlands.
      I help organisations shape how they innovate and integrate their
      systems, building on a background in Cloud Integration, web-based APIs
      and API strategy development.
    </p>
    <p class="text-gray-900 dark:text-gray-400">
      Compassionate about software development and technology in general. I
      love diving into things I don't understand in order to dissect,
      understand and make them accessible for others.
    </p>
  </div>
</template>

<script setup>
usePersonSchema();

useSeoMeta({
  title: "Brandon Verzuu — Cloud Integration, API Strategy & Emerging Tech",
  description:
    "Head of Innovation & Product from Rosmalen, The Netherlands. Practitioner writing on cloud integration, API governance and strategy, and how AI and blockchain reshape technology and people.",
  ogUrl: "https://brandonverzuu.com/",
  // Falls back to the avatar so social previews of the homepage itself
  // resolve to a real file instead of 404ing — see articles/[slug].vue for
  // the origin of this pattern, now applied site-wide on every page that
  // has no page-specific hero image of its own.
  ogImage: "https://brandonverzuu.com/avatar.jpg",
  twitterCard: "summary_large_image",
});
</script>

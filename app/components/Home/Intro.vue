<template>
  <div class="space-y-6">
    <div
      class="flex flex-col items-center space-y-4 md:flex-row md:space-y-0 md:space-x-4"
    >
      <h1 class="mb-0 md:text-left dark:text-gray-100">Hi, I'm Brandon!</h1>
    </div>
    <!-- Backdrop panel: the animated dither background (HomeDitherBackground,
         see app.vue) sits directly behind this text with no separation
         layer, which made the intro hard to read wherever the pattern got
         busy or light-toned. Same blur language as AppNavbar's existing
         backdrop-blur so it stays visually consistent with the rest of the
         hero rather than introducing a new treatment.

         Width: the parent UContainer (app.vue) uses responsive padding
         (px-4 sm:px-6 lg:px-8), so a flat -m-4 only pulled back 16px at
         every breakpoint — 16px short of the lg:px-8 gap, leaving this
         panel narrower than AppNavbar's own max-w-2xl box (measured via
         CDP: 640px vs Navbar's 672px at a 1400px viewport). Matching
         negative margins per breakpoint (-mx-4 sm:-mx-6 lg:-mx-8) make the
         panel's outer edge land exactly on the container's outer edge —
         i.e. exactly as wide as the navbar — at every breakpoint, not
         just the one this was eyeballed at.

         Padding bumped from p-4 to p-6 for more breathing room around the
         text, per feedback that the block felt tight. -->
    <div
      class="-mx-4 -mt-4 -mb-4 space-y-4 rounded-xl bg-white/60 p-6 backdrop-blur-sm sm:-mx-6 lg:-mx-8 dark:bg-black/40"
    >
      <p class="body-text">
        I am Head of Innovation & Product, based in Rosmalen, The Netherlands.
        I help organisations shape how they innovate and integrate their
        systems, building on a background in Cloud Integration, web-based APIs
        and API strategy development.
      </p>
      <p class="body-text">
        Compassionate about software development and technology in general. I
        love diving into things I don't understand in order to dissect,
        understand and make them accessible for others.
      </p>
    </div>
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

<template>
  <main class="min-h-screen">
    <div class="space-y-24">
      <HomeIntro />
      <HomeSocialLinks />
      <!-- HomeDitherBackground (rendered in app.vue) measures this to know
           where to fully fade out — it must finish fading before Featured
           Projects starts, per its own boundary-detection logic. -->
      <div data-dither-boundary></div>
      <HomeFeaturedProjects />
      <HomeFeaturedArticles />
    </div>
  </main>
</template>

<template>
  <main class="min-h-screen">
    <div class="space-y-24">
      <div>
        <HomeIntro />
        <!-- HomeDitherBackground (rendered in app.vue) measures this to know
             where to fully fade out — placed right after the intro, matching
             where every other top-level page puts it (directly after its
             AppHeader), so the homepage hero covers the same title +
             description block and fades out the same way. -->
        <div data-dither-boundary></div>
      </div>
      <HomeSocialLinks />
      <HomeFeaturedProjects />
      <HomeFeaturedArticles />
    </div>
  </main>
</template>

<template>
  <!-- Marks where AppDitherBackground (rendered site-wide in app.vue) fully
       fades out. AppHeader renders this automatically, so pages built on it
       need nothing extra; pages with a custom header block (article posts,
       topic detail) place it themselves right after that block. -->
  <div data-dither-boundary></div>
</template>

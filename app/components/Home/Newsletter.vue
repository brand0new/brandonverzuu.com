<template>
  <div>
    <div class="mb-6 flex items-center gap-3">
      <div
        class="flex-none rounded-full bg-primary-500/10 p-1 text-primary-600 dark:text-primary-500"
      >
        <div class="h-1.5 w-1.5 rounded-full bg-current"></div>
      </div>
      <h2
        class="text-xs font-semibold text-gray-500 uppercase dark:text-gray-400"
      >
        STAY IN TOUCH
      </h2>
    </div>
    <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
      Get notified when I publish something new, and unsubscribe at any time.
    </p>
    <form class="mt-6 flex items-center gap-3" @submit.prevent>
      <label for="newsletter-email" class="sr-only">Email address</label>
      <UInput
        id="newsletter-email"
        type="email"
        placeholder="Email Address"
        icon="i-heroicons-envelope"
        class="flex-1"
        size="lg"
      />
      <UButton type="submit" label="Join &rarr;" size="lg" color="black" />
    </form>
  </div>
</template>

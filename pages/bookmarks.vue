<template>
  <main class="min-h-screen">
    <AppHeader class="mb-8" title="Bookmarks" :description="description" />
    <ul class="space-y-2">
      <li v-for="bookmark in bookmarks" :key="bookmark.id">
        <a :href="bookmark.url" target="_blank"
          class="flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-white/10 p-2 rounded-lg -m-2 text-sm min-w-0">
          <UAvatar :src="getThumbnail(bookmark.url)" :alt="bookmark.label" size="2xl" />
          <p class="truncate text-gray-700 dark:text-gray-200">
            {{ bookmark.label }}
          </p>
          <span class="flex-1"></span>
          <span class="text-xs font-medium text-gray-400 dark:text-gray-600">
            {{ getHost(bookmark.url) }}
          </span>
        </a>
      </li>
    </ul>
  </main>
</template>

<script setup>
const description =
  "Here's some interesting stuff I've found on the internet.";
useSeoMeta({
  title: "Bookmarks | Brandon Verzuu",
  description,
});

const bookmarks = [
  {
    id: 1,
    label: "An Open Source, Privacy first set of developer tools",
    url: "https://devtoys.app",
  },
  {
    id: 2,
    label: "A comprehensive view of all stakeholders creating the programmable economy",
    url: "https://apilandscape.apiscene.io",
  },
  {
    id: 3,
    label: "An online and interactive view of the bitcoin ecosystem",
    url: "https://mempool.space/"
  },
  {
    id: 4,
    label: "A self hosted network-wide ad blocker",
    url: "https://pi-hole.net/"
  },
  {
    id: 5,
    label: "Create and host your own cloud",
    url: "https://umbrel.com"
  },
  {
    id: 6,
    label: "A free fonts service launched by the Indian Type Foundry (ITF)",
    url: "https://fontshare.com"
  },
  {
    id: 7,
    label: "Industrial strength, enterprise grade, beautiful dev tools for code hackers.",
    url: "https://pb33f.io"
  },
  {
    id: 8,
    label: "A helpful tool to determine scale for your Typography",
    url: "https://typescale.com"
  }
];

function getHost(url) {
  const parsedUrl = new URL(url);
  let host = parsedUrl.host;
  if (host.startsWith("www.")) {
    host = host.substring(4);
  }
  return host;
}

function getThumbnail(url) {
  const host = getHost(url);
  return `https://logo.clearbit.com/${host}`;
}
</script>

<template>
  <main>
    <AppHeader class="mb-8" title="Bookmarks" :description="description" />
    <ul class="space-y-5">
      <li v-for="bookmark in bookmarks" :key="bookmark.id">
        <a
          :href="bookmark.url"
          class="-m-2 flex min-w-0 items-center gap-5 rounded-lg p-2 text-sm hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <UAvatar
            :src="getThumbnail(bookmark.url)"
            :alt="bookmark.label"
            size="lg"
            :ui="{ root: 'rounded-md', image: 'rounded-none object-contain' }"
          />
          <div class="flex flex-col">
            <span class="text-gray-700 dark:text-gray-200">
              {{ bookmark.label }}
            </span>
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ getHost(bookmark.url) }}
            </span>
          </div>
        </a>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
const description = "Here's some interesting stuff I've found on the internet.";
useSeoMeta({
  title: "Bookmarks | Brandon Verzuu",
  description,
  ogUrl: "https://brandonverzuu.com/bookmarks",
});

const bookmarks = [
  {
    id: 1,
    label: "An Open Source, Privacy first set of developer tools",
    url: "https://devtoys.app",
  },
  {
    id: 2,
    label:
      "A comprehensive view of all stakeholders creating the programmable economy",
    url: "https://apilandscape.apiscene.io",
  },
  {
    id: 3,
    label: "An online and interactive view of the bitcoin ecosystem",
    url: "https://mempool.space/",
  },
  {
    id: 4,
    label: "A self hosted network-wide ad blocker",
    url: "https://pi-hole.net/",
  },
  {
    id: 5,
    label: "Create and host your own cloud",
    url: "https://umbrel.com",
  },
  {
    id: 6,
    label: "A free fonts service launched by the Indian Type Foundry (ITF)",
    url: "https://fontshare.com",
  },
  {
    id: 7,
    label:
      "Industrial strength, enterprise grade, beautiful dev tools for code hackers.",
    url: "https://pb33f.io",
  },
  {
    id: 8,
    label: "A helpful tool to determine scale for your Typography",
    url: "https://typescale.com",
  },
  {
    id: 9,
    label: "Opensource solution for working with API descriptions",
    url: "https://github.com/speclynx",
  },
  {
    id: 10,
    label: "Agent solution of choice",
    url: "https://hermes-agent.nousresearch.com/",
  },
  {
    id: 11,
    label: "Opensource Digital Signage to display",
    url: "https://anthias.screenly.io/",
  },
];

function getHost(url: string) {
  const parsedUrl = new URL(url);
  let host = parsedUrl.host;
  if (host.startsWith("www.")) {
    host = host.substring(4);
  }
  return host;
}

function getThumbnail(url: string) {
  const host = getHost(url);
  return `https://www.google.com/s2/favicons?sz=128&domain=${host}`;
}
</script>

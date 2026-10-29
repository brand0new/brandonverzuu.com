<template>
  <!-- Items are px-2 below sm so seven icons, the theme toggle and the
       avatar fit a 390px screen; px-3 from sm up, as before. -->
  <header ref="headerRef" :style="styles" class="fixed top-2 z-50 w-full">
    <nav class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
      <ul
        class="my-4 flex items-center rounded-full px-3 text-sm font-medium text-gray-800 shadow-lg ring-1 shadow-gray-800/5 ring-gray-900/5 backdrop-blur dark:text-gray-200 dark:ring-white/20"
      >
        <li v-for="item in items" :key="item.path">
          <UTooltip :text="item.name">
            <ULink
              :to="item.path"
              class="relative flex items-center justify-center px-2 py-4 transition hover:text-primary-600 sm:px-3 dark:hover:text-primary-400"
              active-class="text-primary-600 dark:text-primary-400"
            >
              <client-only>
                <Icon
                  aria-hidden="true"
                  :name="item.icon"
                  class="z-10 h-5 w-5"
                />
              </client-only>
              <span
                v-if="$route.path === item.path"
                class="absolute inset-x-1 -bottom-px h-px bg-gradient-to-r from-primary-500/0 via-primary-500/70 to-primary-500/0 dark:from-primary-400/0 dark:via-primary-400/40 dark:to-primary-400/0"
              ></span>
              <span
                v-if="$route.path === item.path"
                class="absolute top-1/2 left-1/2 z-0 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-100 dark:bg-white/10"
              ></span>
              <span class="sr-only">{{ item.name }}</span>
            </ULink>
          </UTooltip>
        </li>
        <li class="flex-1"></li>
        <li>
          <AppThemeToggle />
        </li>
        <li>
          <UAvatar src="/avatar.jpg" alt="Brandon Verzuu" />
        </li>
      </ul>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useFixedHeader } from "vue-use-fixed-header";

const headerRef = ref(null);

const { styles } = useFixedHeader(headerRef);

const items = [
  {
    name: "Home",
    path: "/",
    icon: "mage:home-fill",
  },
  {
    name: "Articles",
    path: "/articles",
    icon: "mage:book-text-fill",
  },
  {
    name: "Topics",
    path: "/topics",
    icon: "mage:tag-fill",
  },
  {
    name: "Reviews",
    path: "/reviews",
    icon: "mage:star-fill",
  },
  {
    name: "Projects",
    path: "/projects",
    icon: "mage:folder-2-fill",
  },
  {
    name: "Bookmarks",
    path: "/bookmarks",
    icon: "mage:bookmark-fill",
  },
  {
    name: "Expertise",
    path: "/expert",
    icon: "mage:file-check-fill",
  },
];
</script>

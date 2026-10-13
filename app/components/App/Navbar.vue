<template>
  <header ref="headerRef" :style="styles" class="fixed top-2 z-50 w-full">
    <nav class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
      <div
        class="my-4 flex items-center rounded-full px-3 text-sm font-medium text-gray-800 shadow-lg ring-1 shadow-gray-800/5 ring-gray-900/5 backdrop-blur dark:text-gray-200 dark:ring-white/20"
      >
        <!--
          Below sm the page links scroll sideways (swipe, or drag with a
          mouse via useDragScroll) so pages can be added without crowding the
          pinned theme toggle and avatar. From sm up there is room for all of
          them, so overflow goes back to visible and the hover labels aren't
          clipped. pb-px/-mb-px keeps the active underline, which sits at
          -bottom-px, inside the scroll clip.
        -->
        <ul
          ref="scrollerRef"
          :style="fadeStyle"
          class="-mb-px flex min-w-0 flex-1 items-center overflow-x-auto overscroll-x-contain pb-px [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          <li
            v-for="item in items"
            :key="item.path"
            :data-active="item.path === activePath || undefined"
            class="shrink-0"
          >
            <ULink
              :to="item.path"
              class="group/nav hover:text-primary-600 dark:hover:text-primary-400 relative flex items-center justify-center px-3 py-4 transition"
              active-class="text-primary-600 dark:text-primary-400"
            >
              <client-only>
                <Icon
                  aria-hidden="true"
                  :name="item.icon"
                  class="z-10 h-5 w-5"
                />
                <!-- Same size as the icon, so the strip has its real width
                     when onMounted measures it to reveal the active item. -->
                <template #fallback>
                  <div class="h-5 w-5"></div>
                </template>
              </client-only>
              <span
                v-if="$route.path === item.path"
                class="from-primary-500/0 via-primary-500/70 to-primary-500/0 dark:from-primary-400/0 dark:via-primary-400/40 dark:to-primary-400/0 absolute inset-x-1 -bottom-px h-px bg-gradient-to-r"
              ></span>
              <span
                v-if="$route.path === item.path"
                class="absolute top-1/2 left-1/2 z-0 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-100 dark:bg-white/10"
              ></span>
              <span class="sr-only">{{ item.name }}</span>
              <AppNavLabel :text="item.name" />
            </ULink>
          </li>
        </ul>
        <div class="flex shrink-0 items-center">
          <AppThemeToggle />
          <UAvatar src="/avatar.jpg" alt="Brandon Verzuu" />
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
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
    name: "Projects",
    path: "/projects",
    icon: "mage:folder-2-fill",
  },
  {
    name: "Bookmarks",
    path: "/bookmarks",
    icon: "mage:bookmark-fill",
  },
];

const scrollerRef = ref<HTMLElement | null>(null);
const { canScrollStart, canScrollEnd, reveal } = useDragScroll(scrollerRef);

// The section the current route belongs to, so /articles/<slug> still keeps
// the Articles icon in view on mobile. Longest prefix wins over "/".
const route = useRoute();
const activePath = computed(
  () =>
    items
      .map((item) => item.path)
      .filter(
        (path) =>
          route.path === path ||
          (path !== "/" && route.path.startsWith(`${path}/`)),
      )
      .sort((a, b) => b.length - a.length)[0],
);

function revealActive(smooth: boolean) {
  const active =
    scrollerRef.value?.querySelector<HTMLElement>("[data-active]");
  if (active) reveal(active, smooth);
}

onMounted(() => revealActive(false));
watch(activePath, () => nextTick(() => revealActive(true)));

// Fade whichever edge still hides icons. The scrollbar is hidden, so this is
// the only cue that the strip scrolls. A mask rather than an overlay
// gradient keeps the pill's translucent backdrop intact in both themes.
const fadeStyle = computed(() => {
  if (!canScrollStart.value && !canScrollEnd.value) return undefined;
  const start = canScrollStart.value ? "transparent, #000 1.5rem" : "#000";
  const end = canScrollEnd.value
    ? "#000 calc(100% - 1.5rem), transparent"
    : "#000";
  const mask = `linear-gradient(to right, ${start}, ${end})`;
  return { maskImage: mask, WebkitMaskImage: mask };
});
</script>

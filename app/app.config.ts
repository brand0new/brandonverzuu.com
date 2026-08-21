export default defineAppConfig({
  ui: {
    colors: {
      primary: "porcelain",
      neutral: "zinc",
      info: "cyan",
      success: "green",
      warning: "orange",
      error: "red",
    },

    button: {
      slots: {
        base: "rounded-md transition-transform active:scale-x-[0.98] active:scale-y-[0.99]",
      },
    },

    modal: {
      slots: {
        overlay: "bg-[rgba(0,8,47,.275)] saturate-50",
      },
      variants: {
        transition: {
          enterFrom:
            "opacity-0 translate-y-full sm:translate-y-0 sm:scale-x-95",
          leaveFrom: "opacity-100 translate-y-0 sm:scale-x-100",
        },
      },
    },

    container: {
      base: "max-w-sm",
    },

    prose: {
      // Default in-body article link color (@nuxt/ui's ProseA component)
      // uses the raw `primary` (porcelain-500, #5394a4) CSS var, which only
      // hits 3.42:1 contrast against a white page — fails WCAG AA's 4.5:1
      // threshold for normal-size text (confirmed via axe-core audit on
      // /articles/trust-in-ai and /articles/building-platforms-for-vendor-led-enterprises,
      // the two articles with in-body links). Override to a darker shade in
      // light mode only; dark mode's default already has enough contrast
      // against a near-black page, so it keeps the original class.
      a: {
        base: "text-primary-700 dark:text-primary border-b border-transparent hover:border-primary-700 dark:hover:border-primary font-medium rounded-xs outline-primary/25 focus-visible:outline-3 focus-visible:has-[>code]:outline-0 [&>code]:border-dashed [&>code]:outline-primary/25 focus-visible:[&>code]:outline-3 hover:[&>code]:border-primary-700 dark:hover:[&>code]:border-primary hover:[&>code]:text-primary-700 dark:hover:[&>code]:text-primary focus-visible:[&>code]:border-primary-700 dark:focus-visible:[&>code]:border-primary focus-visible:[&>code]:text-primary-700 dark:focus-visible:[&>code]:text-primary",
      },
    },
  },
});

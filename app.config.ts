export default defineAppConfig({
  ui: {
    colors: {
      // Determine Color Scheme for personal site
      primary: "teal",
      secondary: "rose",
    },
    button: {
      rounded:
        "rounded-md transition-transform active:scale-x-[0.98] active:scale-y-[0.99]",
    },
    modal: {
      overlay: {
        background: "bg-[rgba(0,8,47,.275)] saturate-50",
      },
      padding: "p-0",
      rounded: "rounded-t-2xl sm:rounded-xl",
      transition: {
        enterFrom: "opacity-0 translate-y-full sm:translate-y-0 sm:scale-x-95",
        leaveFrom: "opacity-100 translate-y-0 sm:scale-x-100",
      },
    },
    container: {
      constrained: "max-w-sm",
    },
  },
});

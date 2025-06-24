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
          enterFrom: "opacity-0 translate-y-full sm:translate-y-0 sm:scale-x-95",
          leaveFrom: "opacity-100 translate-y-0 sm:scale-x-100",
        }
      }
    },

    container: {
      base: "max-w-sm"
    },
  },
});

// Inline text styles shared by the /expert pages, which aren't wrapped in
// .prose. Link colours match app.config.ts's prose link override:
// porcelain-700 on white is 6.8:1, porcelain-400 on the dark page is 7.2:1.
export const linkClass =
  "font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300";

// gray-800 on gray-100 and gray-200 on white/10 over the dark page both
// stay well above 4.5:1.
export const codeClass =
  "rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.9em] text-gray-800 dark:bg-white/10 dark:text-gray-200";

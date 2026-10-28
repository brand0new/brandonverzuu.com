import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
          // The private rules Worker isn't available here; development uses the stub.
          serviceBindings: {
            RULES: () =>
              new Response("rules Worker not available in tests", {
                status: 501,
              }),
          },
        },
      }),
    ],
    test: {
      include: ["test/**/*.test.ts"],
      // One pool worker per test file. With @cloudflare/vitest-plugin 1.4.9, a
      // worker that runs a second file after test/routes.test.ts crashes workerd
      // with a WebSocket 1009 ("Message is too large") between Node and the
      // runtime; every file passes on its own. Keep this above the file count.
      maxWorkers: 16,
      setupFiles: ["./test/setup.ts"],
    },
  };
});

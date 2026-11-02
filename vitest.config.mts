import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
  },
  resolve: {
    tsconfigPaths: true,
    // "server-only" throws outside Next.js; it's a no-op in tests.
    alias: { "server-only": new URL("./tests/helpers/empty.ts", import.meta.url).pathname },
  },
});

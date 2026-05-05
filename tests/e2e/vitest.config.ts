import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    testTimeout: 15_000,
    include: ["tests/e2e/**/*.test.ts"],
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30000,
    env: {
      INTEGRATION_TEST: process.env.INTEGRATION_TEST || "",
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    },
  },
});

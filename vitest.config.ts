import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    environment: "node",
    environmentMatchGlobs: [
      ["src/components/**", "jsdom"],
      ["src/app/**", "jsdom"],
      ["**/*.tsx", "jsdom"],
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});

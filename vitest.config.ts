import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.worktrees/**"],
    // Integration tests share one Postgres. The seed test wipes & recreates
    // content (opening.deleteMany cascades to lines); running test files in
    // parallel would race that reset against tests that read seeded line ids.
    // Serialize files so the shared DB is never mutated mid-read.
    fileParallelism: false,
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

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Commit SHA in GitHub Actions, timestamp locally. Changes on every deploy.
const buildId = process.env.GITHUB_SHA?.slice(0, 7) ?? String(Date.now());

export default defineConfig({
  plugins: [react()],
  // Relative base so the build works from any GitHub Pages subfolder.
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    rollupOptions: {
      // Build the service worker alongside the app, as a fixed-name sw.js at the site root.
      input: {
        main: path("index.html"),
        sw: path("src/sw.ts"),
      },
      output: {
        entryFileNames: chunk =>
          chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js",
      },
    },
  },
});

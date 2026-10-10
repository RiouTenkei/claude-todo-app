import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works from any GitHub Pages subfolder.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
